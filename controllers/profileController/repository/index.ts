import { db } from '../../../platform/database/connection';
import { findById } from '../../../platform/database/queries';
import { UserProfile } from '../models';

export class ProfileRepository {
  async findById(userId: number): Promise<UserProfile | null> {
    return findById<UserProfile>('users', userId, [
      'id',
      'email',
      'role',
      'is_active',
      'created_at',
    ]);
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    await db.query('UPDATE users SET email = $1 WHERE id = $2', [
      email,
      userId,
    ]);
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
  }

  async deactivateOtherSessions(
    userId: number,
    currentToken: string
  ): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND token != $2 AND is_active = true',
      [userId, currentToken]
    );
  }
}
