import { z } from 'zod';

import { Role } from '../../../types/common';

export const UpdateProfileSchema = z.object({
  email: z.string().email().optional(),
});

export const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
    confirm_password: z.string().min(1),
  })
  .refine(data => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordData = z.infer<typeof ChangePasswordSchema>;

export interface UserProfile {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
}
