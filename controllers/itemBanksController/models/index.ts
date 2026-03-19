import { z } from 'zod';

export const CreateItemBankSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const UpdateItemBankSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const ItemBankListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateItemBankInput = z.infer<typeof CreateItemBankSchema>;
export type UpdateItemBankInput = z.infer<typeof UpdateItemBankSchema>;
export type ItemBankListQuery = z.infer<typeof ItemBankListQuerySchema>;

export interface ItemBank {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  question_count: number;
}
