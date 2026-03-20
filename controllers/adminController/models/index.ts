import { z } from 'zod';

import { Role } from '../../../types/common';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'user']),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user']).optional(),
  is_active: z.boolean().optional(),
});

export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'user']).optional(),
  is_active: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export interface AdminUser {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
