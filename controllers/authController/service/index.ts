import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';

import { config } from '../../../utils/config';
import { generateCsrfToken, storeCsrfToken } from '../../../utils/csrf';
import { createChildLogger } from '../../../utils/logger';
import {
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  User,
} from '../models';
import { AuthRepository } from '../repository';

const logger = createChildLogger('auth-service');

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async login(
    loginData: LoginRequest,
    request: FastifyRequest
  ): Promise<LoginResponse> {
    const { email, password } = loginData;

    logger.info({ email }, 'Login attempt');

    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      logger.warn({ email }, 'Login failed: user not found');
      throw new Error('Invalid credentials');
    }

    const userRecord: User = user;

    if (!userRecord.is_active) {
      logger.warn(
        { email, userId: user.id },
        'Login failed: account disabled'
      );
      throw new Error('Account is disabled');
    }

    if (userRecord.locked_until && userRecord.locked_until > new Date()) {
      logger.warn(
        { email, userId: user.id },
        'Login failed: account locked'
      );
      throw new Error('Account is temporarily locked');
    }

    if (!userRecord.password_hash) {
      logger.error(
        { email, userId: user.id },
        'Login failed: password hash missing'
      );
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      userRecord.password_hash
    );
    if (!isPasswordValid) {
      await this.authRepository.handleFailedLogin(
        user.id,
        userRecord.failed_login_attempts + 1
      );
      logger.warn(
        { email, userId: user.id },
        'Login failed: invalid password'
      );
      throw new Error('Invalid credentials');
    }

    await this.authRepository.handleSuccessfulLogin(user.id);

    const authUser = this.buildAuthUser(user);
    const roles = await this.authRepository.findUserRoles(user.id, authUser.tenant_id);

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await this.authRepository.createSession(
      user.id,
      token,
      refreshToken,
      request
    );

    const csrfToken = generateCsrfToken();
    await storeCsrfToken(token, csrfToken);

    logger.info({ userId: user.id, email }, 'Login successful');

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        role: authUser.role,
        is_active: authUser.is_active,
        tenant_id: authUser.tenant_id,
        roles,
      },
      token,
      refreshToken,
      expiresIn: config.security.jwtExpiresIn,
      csrf_token: csrfToken,
    };
  }

  async register(
    userData: CreateUserRequest & { first_name?: string; last_name?: string }
  ): Promise<User> {
    const { email, password, role, first_name, last_name } = userData;

    logger.info({ email, role }, 'User registration attempt');

    if (!email) {
      throw new Error('Email is required');
    }
    if (!password) {
      throw new Error('Password is required');
    }

    const existingUser = await this.authRepository.findUserByEmail(email);
    if (existingUser) {
      logger.warn({ email }, 'Registration failed: email already exists');
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(
      password,
      config.security.bcryptRounds
    );

    // Assign the default tenant to newly registered users.
    // Platform onboarding in a later batch will replace this.
    const tenantResult = await this.authRepository.findDefaultTenant();
    const tenantId = tenantResult ?? 1;

    const newUser = await this.authRepository.createUserWithRole(
      {
        email,
        password_hash: passwordHash,
        role,
        is_active: true,
        failed_login_attempts: 0,
        tenant_id: tenantId,
        ...(first_name ? { first_name } : {}),
        ...(last_name ? { last_name } : {}),
      },
      role === 'admin' ? 'org_admin' : role,
      tenantId
    );

    logger.info({ userId: newUser.id, email }, 'User registered successfully');

    return this.mapDbUser(newUser);
  }

  async getMe(
    userId: number,
    tenantId: number
  ): Promise<{
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    tenant_id: number;
    roles: string[];
  }> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const mapped = this.mapDbUser(user);
    const roles = await this.authRepository.findUserRoles(userId, tenantId);
    return {
      id: mapped.id.toString(),
      email: mapped.email,
      role: mapped.role,
      is_active: mapped.is_active,
      tenant_id: mapped.tenant_id,
      roles,
    };
  }

  async logout(token: string): Promise<void> {
    await this.authRepository.deactivateSession(token);
    logger.info('User logged out');
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ token: string; refreshToken: string; csrf_token: string }> {
    const session =
      await this.authRepository.findSessionByRefreshToken(refreshToken);

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    const user = await this.authRepository.findUserById(session.user_id);
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.is_active) {
      throw new Error('User not found or inactive');
    }

    const newToken = this.generateToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    await this.authRepository.updateSession(
      session.id,
      newToken,
      newRefreshToken
    );

    const csrfToken = generateCsrfToken();
    await storeCsrfToken(newToken, csrfToken);

    logger.info({ userId: user.id }, 'Token refreshed successfully');

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      csrf_token: csrfToken,
    };
  }

  private generateToken(
    user:
      | User
      | {
          id: string;
          email: string;
          role: string;
          is_active: boolean;
        }
  ): string {
    const payload = {
      sub: Number(user.id),
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    };
    const options = {
      expiresIn: config.security.jwtExpiresIn,
    } as SignOptions;
    return jwt.sign(payload, config.security.jwtSecret, options);
  }

  private generateRefreshToken(user: User): string {
    const payload = { sub: Number(user.id) };
    const options: SignOptions = {
      expiresIn: '30d',
    };
    return jwt.sign(payload, config.security.jwtSecret, options);
  }

  private buildAuthUser(user: User): User {
    return this.mapDbUser(user);
  }

  private mapDbUser(user: User): User {
    return {
      id: Number(user.id),
      email: String(user.email ?? ''),
      role: user.role,
      is_active: Boolean(user.is_active),
      locked_until: user.locked_until,
      failed_login_attempts: Number(user.failed_login_attempts ?? 0),
      tenant_id: Number(user.tenant_id),
      password_hash: '',
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
