import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
import {
  PatchTenantInput,
  PlatformUserRow,
  PlatformUserWithHash,
  TenantDetail,
  TenantRow,
  TenantWithSubscription,
} from '../models';

export class PlatformRepository {
  // ─── Platform users ─────────────────────────────────────────────────────────

  async findPlatformUserByEmail(email: string): Promise<PlatformUserWithHash | null> {
    const result = await db.query<PlatformUserWithHash>(
      `SELECT id, email, password_hash, platform_role, first_name, last_name,
              is_active, last_login, created_at, updated_at
       FROM platform_users
       WHERE email = $1`,
      [email]
    );
    return result.rows[0] ?? null;
  }

  async findPlatformUserById(id: number): Promise<PlatformUserRow | null> {
    const result = await db.query<PlatformUserRow>(
      `SELECT id, email, platform_role, first_name, last_name,
              is_active, last_login, created_at, updated_at
       FROM platform_users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async updateLastLogin(id: number): Promise<void> {
    await db.query(
      'UPDATE platform_users SET last_login = NOW() WHERE id = $1',
      [id]
    );
  }

  async listPlatformUsers(): Promise<PlatformUserRow[]> {
    const result = await db.query<PlatformUserRow>(
      `SELECT id, email, platform_role, first_name, last_name,
              is_active, last_login, created_at, updated_at
       FROM platform_users
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async createPlatformUser(data: {
    email: string;
    password_hash: string;
    platform_role: string;
    first_name: string | null;
    last_name: string | null;
  }): Promise<PlatformUserRow> {
    const result = await db.query<PlatformUserRow>(
      `INSERT INTO platform_users (email, password_hash, platform_role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, platform_role, first_name, last_name,
                 is_active, last_login, created_at, updated_at`,
      [data.email, data.password_hash, data.platform_role, data.first_name, data.last_name]
    );
    return result.rows[0]!;
  }

  // ─── Tenants ─────────────────────────────────────────────────────────────────

  async listTenants(): Promise<TenantWithSubscription[]> {
    const result = await db.query<TenantWithSubscription>(
      `SELECT
         t.id, t.name, t.slug, t.status, t.plan, t.created_at, t.updated_at,
         row_to_json(s.*) AS subscription,
         COUNT(DISTINCT u.id)::int AS seat_usage
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN users u ON u.tenant_id = t.id AND u.is_active = true
       GROUP BY t.id, s.id
       ORDER BY t.created_at DESC`
    );
    return result.rows;
  }

  async findTenantById(id: number): Promise<TenantDetail | null> {
    const result = await db.query<TenantDetail>(
      `SELECT
         t.id, t.name, t.slug, t.status, t.plan, t.created_at, t.updated_at,
         row_to_json(s.*) AS subscription,
         COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = true)::int AS seat_usage,
         COUNT(DISTINCT u.id)::int AS user_count
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY t.id, s.id`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async patchTenant(id: number, data: PatchTenantInput): Promise<TenantRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(data.status);
    }
    if (data.plan !== undefined) {
      fields.push(`plan = $${idx++}`);
      params.push(data.plan);
    }

    if (fields.length === 0) return this.findTenantById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query<TenantRow>(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  }

  // ─── Tenant creation (atomic) ─────────────────────────────────────────────

  async createTenantAtomically(
    client: PoolClient,
    data: {
      name: string;
      slug: string;
      plan: string;
      admin_email: string;
      admin_first_name: string;
      admin_last_name: string;
      password_hash: string;
    }
  ): Promise<{ tenant: TenantRow; admin_user_id: number }> {
    // 1. Create tenant
    const tenantResult = await client.query<TenantRow>(
      `INSERT INTO tenants (name, slug, plan)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.slug, data.plan]
    );
    const tenant = tenantResult.rows[0]!;

    // 2. Create subscription
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan)
       VALUES ($1, $2)`,
      [tenant.id, data.plan]
    );

    // 3. Create org admin user
    const userResult = await client.query<{ id: number }>(
      `INSERT INTO users
         (email, password_hash, role, is_active, tenant_id,
          first_name, last_name, failed_login_attempts, must_change_password)
       VALUES ($1, $2, 'org_admin', true, $3, $4, $5, 0, true)
       RETURNING id`,
      [data.admin_email, data.password_hash, tenant.id, data.admin_first_name, data.admin_last_name]
    );
    const adminUserId = userResult.rows[0]!.id;

    // 4. Create user_role
    await client.query(
      `INSERT INTO user_roles (user_id, role, tenant_id)
       VALUES ($1, 'org_admin', $2)`,
      [adminUserId, tenant.id]
    );

    return { tenant, admin_user_id: adminUserId };
  }
}
