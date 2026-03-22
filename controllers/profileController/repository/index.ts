import { db } from '../../../platform/database/connection';
import { findById } from '../../../platform/database/queries';
import { UpdateProfileData, UserProfile } from '../models';

export class ProfileRepository {
  async findById(userId: number): Promise<UserProfile | null> {
    return findById<UserProfile>('users', userId, [
      'id',
      'email',
      'role',
      'is_active',
      'first_name',
      'last_name',
      'username',
      'phone_number',
      'created_at',
    ]);
  }

  async updateEmail(userId: number, email: string): Promise<void> {
    await db.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [
      email,
      userId,
    ]);
  }

  async updateProfile(
    userId: number,
    data: Pick<UpdateProfileData, 'first_name' | 'last_name' | 'phone_number'>
  ): Promise<void> {
    await db.query(
      `UPDATE users
         SET first_name   = COALESCE($1, first_name),
             last_name    = COALESCE($2, last_name),
             phone_number = COALESCE($3, phone_number),
             updated_at   = NOW()
       WHERE id = $4`,
      [data.first_name ?? null, data.last_name ?? null, data.phone_number ?? null, userId]
    );
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
