// controllers/assessmentsController/models/index.ts
import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const AssessmentTypeEnum = z.enum(['quiz', 'exam']);
export type AssessmentType = z.infer<typeof AssessmentTypeEnum>;

export const AssessmentStatusEnum = z.enum(['draft', 'published', 'archived']);
export type AssessmentStatus = z.infer<typeof AssessmentStatusEnum>;

export const ViolationTypeEnum = z.enum([
  'tab_switch',
  'copy_paste',
  'fullscreen_exit',
  'idle',
]);
export type ViolationType = z.infer<typeof ViolationTypeEnum>;

// ─── Input schemas ───────────────────────────────────────────────────────────

export const CreateAssessmentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: AssessmentTypeEnum.default('exam'),
  course_id: z.number().int().positive().optional(),
  time_limit_mins: z.number().int().positive().optional(),
  max_attempts: z.number().int().min(1).default(1),
  passing_score_percent: z.number().min(0).max(100).default(70),
  question_count: z.number().int().min(1).default(10),
  randomize_questions: z.boolean().default(true),
  anti_cheat_enabled: z.boolean().default(false),
  status: AssessmentStatusEnum.default('draft'),
});
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;

export const UpdateAssessmentSchema = CreateAssessmentSchema.partial();
export type UpdateAssessmentInput = z.infer<typeof UpdateAssessmentSchema>;

export const ListAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: AssessmentStatusEnum.optional(),
  type: AssessmentTypeEnum.optional(),
  course_id: z.coerce.number().int().positive().optional(),
});
export type ListAssessmentsQuery = z.infer<typeof ListAssessmentsQuerySchema>;

export const AddToPoolSchema = z.object({
  question_ids: z.array(z.number().int().positive()).min(1).max(100),
});
export type AddToPoolInput = z.infer<typeof AddToPoolSchema>;

export const SaveAnswerSchema = z.object({
  question_id: z.number().int().positive(),
  answer: z.record(z.string(), z.unknown()),
});
export type SaveAnswerInput = z.infer<typeof SaveAnswerSchema>;

export const ViolationSchema = z.object({
  violation_type: ViolationTypeEnum,
});
export type ViolationInput = z.infer<typeof ViolationSchema>;

// ─── Database row interfaces ─────────────────────────────────────────────────

export interface Assessment {
  id: number;
  tenant_id: number;
  course_id: number | null;
  created_by: number | null;
  title: string;
  description: string | null;
  type: AssessmentType;
  time_limit_mins: number | null;
  max_attempts: number;
  passing_score_percent: string; // pg returns NUMERIC as string
  question_count: number;
  randomize_questions: boolean;
  anti_cheat_enabled: boolean;
  status: AssessmentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AssessmentPoolQuestion {
  id: number;
  assessment_id: number;
  question_id: number;
  added_at: Date;
  name: string;   // questions table uses `name`, not `title`
  type: string;
}

export interface Attempt {
  id: number;
  assessment_id: number;
  user_id: number;
  tenant_id: number;
  attempt_number: number;
  started_at: Date;
  submitted_at: Date | null;
  deadline_at: Date | null;
  score_percent: string | null; // pg returns NUMERIC as string
  passed: boolean | null;
  auto_submitted: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface AttemptAnswer {
  id: number;
  attempt_id: number;
  question_id: number;
  answer: Record<string, unknown>;
  is_correct: boolean | null;
  points_awarded: string | null; // pg returns NUMERIC as string
  saved_at: Date;
}

export interface AttemptQuestionWithContent {
  question_id: number;
  position: number;
  type: string;
  content: Record<string, unknown>;
}
