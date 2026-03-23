import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  parent_id: z.number().int().positive().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(2).max(100),
});

export const AssignQuestionsSchema = z.object({
  question_ids: z.array(z.number().int().positive()).min(1),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type AssignQuestionsInput = z.infer<typeof AssignQuestionsSchema>;

export interface Category {
  id: number;
  name: string;
  children: Category[];
}

export interface FlatCategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  path: number[];
}
