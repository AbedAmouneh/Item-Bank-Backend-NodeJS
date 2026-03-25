import { z } from 'zod';

import { Role } from '../../../types/common';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'user', 'learner']),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user', 'learner']).optional(),
  is_active: z.boolean().optional(),
  course_assignment_mode: z.enum(['all_access', 'assigned_only']).optional(),
});

export const AssignItemBankSchema = z.object({
  item_bank_id: z.number().int().positive(),
});

export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'user', 'learner']).optional(),
  is_active: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;
export type AssignItemBankInput = z.infer<typeof AssignItemBankSchema>;

export interface AdminUser {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  course_assignment_mode: string;
  created_at: Date;
  updated_at: Date;
}

/** Shape returned by GET /admin/users/:id/item-banks — mirrors the frontend ItemBank type. */
export interface UserItemBankAccess {
  id: number;
  name: string;
  assigned_at: Date;
}

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  user_id: z.coerce.number().int().positive().optional(),
  entity_type: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export interface AuditLog {
  id: number;
  user_id: number | null;
  request_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string | null;
  query_text: string;
  query_params: unknown[] | null;
  timestamp: Date;
  duration_ms: number | null;
  success: boolean;
  user_name: string | null;
}
