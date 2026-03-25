import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

import { db } from '../../../platform/database/connection';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import {
  CreatePlatformUserInput,
  CreateTenantInput,
  PatchTenantInput,
  PlatformLoginInput,
  PlatformUserRow,
  TenantDetail,
  TenantRow,
  TenantWithSubscription,
} from '../models';
import { PlatformRepository } from '../repository';

const logger = createChildLogger('platform-service');
const repo = new PlatformRepository();

export class PlatformService {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  async login(data: PlatformLoginInput): Promise<{ token: string; user: PlatformUserRow }> {
    const user = await repo.findPlatformUserByEmail(data.email);

    if (!user) {
      logger.warn({ email: data.email }, 'Platform login failed: user not found');
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      logger.warn({ email: data.email }, 'Platform login failed: account inactive');
      throw new Error('Account is disabled');
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      logger.warn({ email: data.email }, 'Platform login failed: wrong password');
      throw new Error('Invalid credentials');
    }

    await repo.updateLastLogin(user.id);

    const token = this.signToken(user);

    logger.info({ userId: user.id }, 'Platform login successful');

    const { password_hash: _omit, ...safeUser } = user;
    return { token, user: safeUser as PlatformUserRow };
  }

  async getMe(id: number): Promise<PlatformUserRow> {
    const user = await repo.findPlatformUserById(id);
    if (!user) throw new Error('Platform user not found');
    return user;
  }

  // ─── Tenants ───────────────────────────────────────────────────────────────

  async listTenants(): Promise<TenantWithSubscription[]> {
    return repo.listTenants();
  }

  async getTenant(id: number): Promise<TenantDetail> {
    const tenant = await repo.findTenantById(id);
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  }

  async createTenant(
    data: CreateTenantInput
  ): Promise<{ tenant: TenantRow; admin_email: string; temp_password: string }> {
    const tempPassword = randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, config.security.bcryptRounds);

    const result = await db.transaction(async client => {
      return repo.createTenantAtomically(client, {
        ...data,
        password_hash: passwordHash,
      });
    });

    logger.info({ tenantId: result.tenant.id, adminUserId: result.admin_user_id }, 'Tenant created');

    return {
      tenant: result.tenant,
      admin_email: data.admin_email,
      temp_password: tempPassword,
    };
  }

  async patchTenant(id: number, data: PatchTenantInput): Promise<TenantRow> {
    const existing = await repo.findTenantById(id);
    if (!existing) throw new Error('Tenant not found');

    const updated = await repo.patchTenant(id, data);
    if (!updated) throw new Error('Tenant not found');
    return updated;
  }

  // ─── Platform users ────────────────────────────────────────────────────────

  async listPlatformUsers(): Promise<PlatformUserRow[]> {
    return repo.listPlatformUsers();
  }

  async createPlatformUser(data: CreatePlatformUserInput): Promise<PlatformUserRow> {
    const existing = await repo.findPlatformUserByEmail(data.email);
    if (existing) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, config.security.bcryptRounds);

    return repo.createPlatformUser({
      email: data.email,
      password_hash: passwordHash,
      platform_role: data.platform_role,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
    });
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private signToken(user: PlatformUserRow): string {
    const payload = {
      sub: user.id,
      email: user.email,
      platform_role: user.platform_role,
    };
    const options: SignOptions = { expiresIn: '8h' };
    return jwt.sign(payload, config.security.platformJwtSecret, options);
  }
}
