import { z } from 'zod';

export type PlatformRole = 'super_admin' | 'sales';

// ─── Request schemas ──────────────────────────────────────────────────────────

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  plan: z.string().min(1),
  admin_email: z.string().email(),
  admin_first_name: z.string().min(1),
  admin_last_name: z.string().min(1),
});

export const patchTenantSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  plan: z.string().min(1).optional(),
});

export const createPlatformUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  platform_role: z.enum(['super_admin', 'sales']),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

// ─── Database row types ───────────────────────────────────────────────────────

export interface PlatformUserRow {
  id: number;
  email: string;
  platform_role: PlatformRole;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformUserWithHash extends PlatformUserRow {
  password_hash: string;
}

export interface TenantRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  plan: string;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionRow {
  id: number;
  tenant_id: number;
  plan: string;
  seats_purchased: number;
  billing_cycle: string;
  trial_ends_at: Date | null;
  current_period_start: Date;
  current_period_end: Date | null;
  status: string;
  created_at: Date;
}

export interface TenantWithSubscription extends TenantRow {
  subscription: SubscriptionRow | null;
  seat_usage: number;
}

export interface TenantDetail extends TenantWithSubscription {
  user_count: number;
}

// ─── Inferred input types ─────────────────────────────────────────────────────

export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type PatchTenantInput = z.infer<typeof patchTenantSchema>;
export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>;
