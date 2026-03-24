import { z } from 'zod';

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
});

export const TagListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type TagListQuery = z.infer<typeof TagListQuerySchema>;

export interface Tag {
  id: number;
  name: string;
  slug: string;
  created_at: Date;
  question_count: number;
}
