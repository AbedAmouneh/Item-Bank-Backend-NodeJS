import { FastifyRequest } from 'fastify';
import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
import { create, findById, update } from '../../../platform/database/queries';
import { generateFingerprint } from '../../../utils/fingerprint';
import { User, UserSession } from '../models';

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: number): Promise<User | null> {
    return findById<User>('users', id);
  }

  async findUserRoles(userId: number, tenantId: number): Promise<string[]> {
    const result = await db.query<{ role: string }>(
      'SELECT role FROM user_roles WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    return result.rows.map(r => r.role);
  }

  async createUser(data: {
    email: string;
    password_hash: string | null;
    role: string;
    is_active: boolean;
    failed_login_attempts: number;
    tenant_id: number;
  }): Promise<User> {
    return create<User>('users', data);
  }

  async updateUser(
    id: number,
    data: Record<string, unknown>
  ): Promise<User | null> {
    return update<User>('users', id, data);
  }

  async handleFailedLogin(
    userId: number,
    failedAttempts: number
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      failed_login_attempts: failedAttempts,
    };

    if (failedAttempts >= 5) {
      const lockDuration = 30 * 60 * 1000; // 30 minutes
      updateData['locked_until'] = new Date(Date.now() + lockDuration);
    }

    await update('users', userId, updateData);
  }

  async handleSuccessfulLogin(userId: number): Promise<void> {
    await update('users', userId, {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
    });
  }

  async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<UserSession | null> {
    const result = await db.query<UserSession>(
      'SELECT * FROM user_sessions WHERE refresh_token = $1 AND is_active = true AND expires_at > NOW()',
      [refreshToken]
    );
    return result.rows[0] || null;
  }

  async updateSession(
    sessionId: number,
    token: string,
    refreshToken: string
  ): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET token = $1, refresh_token = $2, last_activity_at = NOW() WHERE id = $3',
      [token, refreshToken, sessionId]
    );
  }

  async createSession(
    userId: number,
    token: string,
    refreshToken: string,
    request: FastifyRequest
  ): Promise<void> {
    const fingerprint = generateFingerprint(request);

    await create('user_sessions', {
      user_id: userId,
      token,
      refresh_token: refreshToken,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || 'unknown',
      fingerprint,
      is_active: true,
      expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years (non-expiring)
      last_activity_at: new Date(),
    });
  }

  async deactivateSession(token: string): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE token = $1',
      [token]
    );
  }

  async findDefaultTenant(): Promise<number | null> {
    const result = await db.query<{ id: number }>(
      'SELECT id FROM tenants WHERE slug = $1',
      ['default']
    );
    return result.rows[0]?.id ?? null;
  }

  async createUserRole(userId: number, role: string, tenantId: number): Promise<void> {
    await db.query(
      `INSERT INTO user_roles (user_id, role, tenant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role, tenant_id) DO NOTHING`,
      [userId, role, tenantId]
    );
  }

  async createUserWithRole(
    userData: {
      email: string;
      password_hash: string | null;
      role: string;
      is_active: boolean;
      failed_login_attempts: number;
      tenant_id: number;
      first_name?: string;
      last_name?: string;
    },
    roleName: string,
    tenantId: number
  ): Promise<User> {
    return db.transaction(async (client: PoolClient) => {
      const userResult = await client.query<User>(
        `INSERT INTO users (email, password_hash, role, is_active, failed_login_attempts, tenant_id, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userData.email,
          userData.password_hash,
          userData.role,
          userData.is_active,
          userData.failed_login_attempts,
          userData.tenant_id,
          userData.first_name ?? null,
          userData.last_name ?? null,
        ]
      );
      const user = userResult.rows[0];
      if (!user) throw new Error('Failed to create user');

      const roleResult = await client.query(
        `INSERT INTO user_roles (user_id, role, tenant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role, tenant_id) DO NOTHING`,
        [user.id, roleName, tenantId]
      );
      if ((roleResult.rowCount ?? 0) === 0) {
        throw new Error('Failed to create user role');
      }

      return user;
    });
  }
}
