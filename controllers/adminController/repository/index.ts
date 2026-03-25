import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
import { update } from '../../../platform/database/queries';
import { AdminUser, AdminUserListQuery, AuditLog, AuditLogQuery, UpdateUserInput, UserItemBankAccess } from '../models';

const USER_COLUMNS = [
  'id',
  'email',
  'role',
  'is_active',
  'course_assignment_mode',
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
    // Resolve the default tenant — mirrors the pattern used in AuthRepository.
    const tenantResult = await db.query<{ id: number }>(
      `SELECT id FROM tenants WHERE slug = $1`,
      ['default']
    );
    const tenantId = tenantResult.rows[0]?.id ?? 1;

    // The user_roles table maps 'admin' to 'org_admin', matching auth service convention.
    const userRoleName = data.role === 'admin' ? 'org_admin' : data.role;

    return db.transaction(async (client: PoolClient) => {
      const userResult = await client.query<AdminUser>(
        `INSERT INTO users (email, password_hash, role, is_active, failed_login_attempts, tenant_id)
         VALUES ($1, $2, $3, true, 0, $4)
         RETURNING ${USER_COLUMNS_SQL}`,
        [data.email, data.password_hash, data.role, tenantId]
      );
      const user = userResult.rows[0];
      if (!user) throw new Error('Failed to create user');

      await client.query(
        `INSERT INTO user_roles (user_id, role, tenant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role, tenant_id) DO NOTHING`,
        [user.id, userRoleName, tenantId]
      );

      return user;
    });
  }

  async update(id: number, data: UpdateUserInput): Promise<AdminUser | null> {
    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData['email'] = data.email;
    if (data.role !== undefined) updateData['role'] = data.role;
    if (data.is_active !== undefined) updateData['is_active'] = data.is_active;
    if (data.course_assignment_mode !== undefined) updateData['course_assignment_mode'] = data.course_assignment_mode;

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    // When the role changes, sync the user_roles table so that the JWT
    // roles array (populated by findUserRoles) reflects the new role.
    if (data.role !== undefined) {
      const userRow = await db.query<{ tenant_id: number }>(
        'SELECT tenant_id FROM users WHERE id = $1',
        [id]
      );
      const tenantId = userRow.rows[0]?.tenant_id;
      if (tenantId != null) {
        const userRoleName = data.role === 'admin' ? 'org_admin' : data.role;
        // Replace all existing roles for this user/tenant with the single new role.
        await db.query(
          'DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2',
          [id, tenantId]
        );
        await db.query(
          `INSERT INTO user_roles (user_id, role, tenant_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, role, tenant_id) DO NOTHING`,
          [id, userRoleName, tenantId]
        );
      }
    }

    return update<AdminUser>('users', id, updateData, USER_COLUMNS);
  }

  async listUserItemBanks(userId: number): Promise<UserItemBankAccess[]> {
    const result = await db.query<UserItemBankAccess>(
      `SELECT uiba.item_bank_id AS id, ib.name, uiba.assigned_at
       FROM user_item_bank_access uiba
       JOIN item_banks ib ON ib.id = uiba.item_bank_id
       WHERE uiba.user_id = $1
       ORDER BY uiba.assigned_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async assignItemBank(userId: number, itemBankId: number, assignedBy: number): Promise<void> {
    await db.query(
      `INSERT INTO user_item_bank_access (user_id, item_bank_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_bank_id) DO NOTHING`,
      [userId, itemBankId, assignedBy]
    );
  }

  async revokeItemBank(userId: number, itemBankId: number): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM user_item_bank_access WHERE user_id = $1 AND item_bank_id = $2`,
      [userId, itemBankId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAuditLogs(
    query: AuditLogQuery
  ): Promise<{ items: AuditLog[]; total: number; page: number; limit: number }> {
    const { page, limit, user_id, entity_type, action, from, to } = query;
    const offset = (page - 1) * limit;

    const filterParams: unknown[] = [
      user_id ?? null,
      entity_type ?? null,
      action ?? null,
      from ?? null,
      to ?? null,
    ];

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM audit_logs al
       WHERE
         ($1::bigint IS NULL OR al.user_id = $1::bigint)
         AND ($2::text IS NULL OR al.entity_type = $2::text)
         AND ($3::text IS NULL OR al.action = $3::text)
         AND ($4::timestamptz IS NULL OR al.timestamp >= $4::timestamptz)
         AND ($5::timestamptz IS NULL OR al.timestamp <= $5::timestamptz)`,
      filterParams
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const dataResult = await db.query<AuditLog>(
      `SELECT al.*, u.email AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE
         ($1::bigint IS NULL OR al.user_id = $1::bigint)
         AND ($2::text IS NULL OR al.entity_type = $2::text)
         AND ($3::text IS NULL OR al.action = $3::text)
         AND ($4::timestamptz IS NULL OR al.timestamp >= $4::timestamptz)
         AND ($5::timestamptz IS NULL OR al.timestamp <= $5::timestamptz)
       ORDER BY al.timestamp DESC
       LIMIT $6 OFFSET $7`,
      [...filterParams, limit, offset]
    );

    return { items: dataResult.rows, total, page, limit };
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
