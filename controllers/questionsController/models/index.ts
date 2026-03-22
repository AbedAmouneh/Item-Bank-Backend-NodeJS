import { z } from 'zod';

export const QuestionType = z.enum([
  'true_false',
  'short_answer',
  'multiple_choice',
  'essay',
  'fill_in_blanks',
  'fill_in_blanks_image',
  'text_sequencing',
  'image_sequencing',
  'free_hand_drawing',
  'select_correct_word',
  'record_audio',
  'numerical',
  'highlight_correct_word',
  'multiple_hotspots',
  'drag_drop_text',
  'drag_drop_image',
  'text_classification',
  'image_classification',
  'matching',
  'crossword',
]);

export const QuestionStatus = z.enum(['draft', 'in_review', 'published']);

export const CreateQuestionSchema = z.object({
  name: z.string().min(1).max(500),
  type: QuestionType,
  text: z.string().nullable().optional(),
  mark: z.coerce.number().min(0).optional().default(1),
  item_bank_id: z.number().int().optional(),
  tag_ids: z.array(z.number().int()).optional().default([]),
  content: z.record(z.string(), z.unknown()).optional().default({}),
});

export const UpdateQuestionSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(500).optional(),
  type: QuestionType.optional(),
  text: z.string().optional(),
  mark: z.number().min(0).optional(),
  status: QuestionStatus.optional(),
  item_bank_id: z.number().int().optional(),
  tag_ids: z.array(z.number().int()).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

export const QuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: QuestionType.optional(),
  status: QuestionStatus.optional(),
  item_bank_id: z.coerce.number().int().optional(),
  search: z.string().optional(),
});

export const SubmitForReviewSchema = z.object({
  id: z.number().int(),
});

export const RejectQuestionSchema = z.object({
  id: z.number().int(),
  rejection_note: z.string().min(1),
});

export type QuestionTypeEnum = z.infer<typeof QuestionType>;
export type QuestionStatusEnum = z.infer<typeof QuestionStatus>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;
export type SubmitForReviewInput = z.infer<typeof SubmitForReviewSchema>;
export type RejectQuestionInput = z.infer<typeof RejectQuestionSchema>;

export interface Question {
  id: number;
  item_bank_id: number | null;
  owner_id: number;
  type: QuestionTypeEnum;
  name: string;
  text: string | null;
  mark: number;
  status: QuestionStatusEnum;
  content: Record<string, unknown>;
  rejection_note: string | null;
  created_at: Date;
  updated_at: Date;
  tags?: { id: number; name: string; slug: string }[];
}
