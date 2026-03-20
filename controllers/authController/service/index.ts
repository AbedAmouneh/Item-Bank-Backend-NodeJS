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

    const userRecord = user as unknown as {
      is_active: boolean;
      locked_until: Date | null;
      password_hash: string | null;
      failed_login_attempts: number;
      id: string;
      email: string;
      role: string;
    };

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

    const authUser = this.buildAuthUser(user);

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        role: authUser.role,
        is_active: authUser.is_active,
      },
      token,
      refreshToken,
      expiresIn: config.security.jwtExpiresIn,
      csrf_token: csrfToken,
    };
  }

  async register(userData: CreateUserRequest): Promise<User> {
    const { email, password, role } = userData;

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

    const newUser = await this.authRepository.createUser({
      email,
      password_hash: passwordHash,
      role,
      is_active: true,
      failed_login_attempts: 0,
    });

    const persistedUser = await this.authRepository.findUserById(newUser.id);

    logger.info({ userId: newUser.id, email }, 'User registered successfully');

    return this.mapDbUser(persistedUser ?? newUser);
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

    const sessionRecord = session as unknown as {
      user_id: number;
      id: number;
    };
    const user = await this.authRepository.findUserById(sessionRecord.user_id);
    if (!user) {
      throw new Error('User not found');
    }
    const userRecord = user as unknown as { is_active: boolean };
    if (!userRecord.is_active) {
      throw new Error('User not found or inactive');
    }

    const newToken = this.generateToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    await this.authRepository.updateSession(
      sessionRecord.id,
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
    const userRecord = user as unknown as {
      id: string;
      email: string;
      role: string;
      is_active: boolean;
    };
    const payload = {
      sub: Number(userRecord.id),
      email: userRecord.email,
      role: userRecord.role,
      is_active: userRecord.is_active,
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

  private buildAuthUser(user: unknown): User {
    return this.mapDbUser(user);
  }

  private mapDbUser(user: unknown): User {
    const rest = user as Record<string, unknown>;
    return {
      id: Number(rest['id']),
      email: String(rest['email'] ?? ''),
      role: rest['role'] as User['role'],
      is_active: Boolean(rest['is_active']),
      password_hash: '',
      created_at: rest['created_at'] as Date,
      updated_at: rest['updated_at'] as Date,
    };
  }
}
