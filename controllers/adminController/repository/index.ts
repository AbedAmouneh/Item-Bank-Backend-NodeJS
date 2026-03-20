import { db } from '../../../platform/database/connection';
import { create, update } from '../../../platform/database/queries';
import { AdminUser, AdminUserListQuery, UpdateUserInput } from '../models';

const USER_COLUMNS = [
  'id',
  'email',
  'role',
  'is_active',
  'created_at',
  'updated_at',
];

const USER_COLUMNS_SQL = USER_COLUMNS.join(', ');

export class AdminRepository {
  async findAll(
    query: AdminUserListQuery
  ): Promise<{ items: AdminUser[]; total: number; page: number; limit: number }> {
    const { page, limit, role, is_active, search } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role !== undefined) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (search !== undefined) {
      conditions.push(`email ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<AdminUser>(
      `SELECT ${USER_COLUMNS_SQL} FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number): Promise<AdminUser | null> {
    const result = await db.query<AdminUser>(
      `SELECT ${USER_COLUMNS_SQL} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(data: {
    email: string;
    password_hash: string;
    role: string;
  }): Promise<AdminUser> {
    return create<AdminUser>(
      'users',
      {
        email: data.email,
        password_hash: data.password_hash,
        role: data.role,
        is_active: true,
        failed_login_attempts: 0,
      },
      USER_COLUMNS
    );
  }

  async update(id: number, data: UpdateUserInput): Promise<AdminUser | null> {
    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData['email'] = data.email;
    if (data.role !== undefined) updateData['role'] = data.role;
    if (data.is_active !== undefined) updateData['is_active'] = data.is_active;

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    return update<AdminUser>('users', id, updateData, USER_COLUMNS);
  }

  async activate(id: number): Promise<void> {
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [id]);
  }

  async deactivate(id: number): Promise<void> {
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
      [id]
    );
  }
}
