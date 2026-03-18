import { FastifyRequest } from 'fastify';

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

  async createUser(data: {
    email: string;
    password_hash: string | null;
    role: string;
    is_active: boolean;
    failed_login_attempts: number;
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
}
