// controllers/assignmentsController/models/index.ts
import { z } from 'zod';

// ─── Status enums ─────────────────────────────────────────────────────────────

export const AssignmentStatusEnum = z.enum(['draft', 'published', 'archived']);
export type AssignmentStatus = z.infer<typeof AssignmentStatusEnum>;

export const SubmissionStatusEnum = z.enum(['draft', 'submitted', 'graded']);
export type SubmissionStatus = z.infer<typeof SubmissionStatusEnum>;

export const ComponentTypeEnum = z.enum(['text', 'file', 'url', 'question']);
export type ComponentType = z.infer<typeof ComponentTypeEnum>;

// ─── Input schemas ────────────────────────────────────────────────────────────

export const ComponentInputSchema = z.object({
  type: ComponentTypeEnum,
  prompt: z.string().max(2000).optional(),
  question_id: z.number().int().positive().optional(),
  max_points: z.number().positive().default(10),
  position: z.number().int().min(0).default(0),
});
export type ComponentInput = z.infer<typeof ComponentInputSchema>;

export const CreateAssignmentSchema = z.object({
  title: z.string().min(1).max(255),
  instructions: z.string().max(5000).optional(),
  max_score: z.number().positive().default(100),
  due_date: z.string().datetime({ offset: true }).optional(),
  status: AssignmentStatusEnum.default('draft'),
  course_id: z.number().int().positive().optional(),
  components: z.array(ComponentInputSchema).default([]),
});
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export const UpdateAssignmentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  instructions: z.string().max(5000).optional(),
  max_score: z.number().positive().optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  status: AssignmentStatusEnum.optional(),
  course_id: z.number().int().positive().nullable().optional(),
  components: z.array(ComponentInputSchema).optional(),
});
export type UpdateAssignmentInput = z.infer<typeof UpdateAssignmentSchema>;

export const ListAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: AssignmentStatusEnum.optional(),
  course_id: z.coerce.number().int().positive().optional(),
});
export type ListAssignmentsQuery = z.infer<typeof ListAssignmentsQuerySchema>;

export const AssignUsersSchema = z.object({
  user_ids: z.array(z.number().int().positive()).min(1),
});
export type AssignUsersInput = z.infer<typeof AssignUsersSchema>;

export const ComponentResponseSchema = z.object({
  component_id: z.number().int().positive(),
  text_answer: z.string().optional(),
  file_url: z.string().url().max(500).optional(),
  url_answer: z.string().url().max(500).optional(),
  question_answer: z.record(z.unknown()).optional(),
});
export type ComponentResponse = z.infer<typeof ComponentResponseSchema>;

export const SaveSubmissionSchema = z.object({
  responses: z.array(ComponentResponseSchema).default([]),
  action: z.enum(['draft', 'submit']),
});
export type SaveSubmissionInput = z.infer<typeof SaveSubmissionSchema>;

export const ComponentGradeInputSchema = z.object({
  component_id: z.number().int().positive(),
  points_awarded: z.number().min(0),
  comment: z.string().optional(),
});
export type ComponentGradeInput = z.infer<typeof ComponentGradeInputSchema>;

export const GradeSubmissionSchema = z.object({
  component_grades: z.array(ComponentGradeInputSchema).default([]),
  overall_feedback: z.string().optional(),
});
export type GradeSubmissionInput = z.infer<typeof GradeSubmissionSchema>;

// ─── Database row interfaces ──────────────────────────────────────────────────
// Note: PostgreSQL returns NUMERIC columns as strings

export interface Assignment {
  id: number;
  tenant_id: number;
  course_id: number | null;
  created_by: number | null;
  title: string;
  instructions: string | null;
  max_score: string;
  due_date: Date | null;
  status: AssignmentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AssignmentComponent {
  id: number;
  assignment_id: number;
  position: number;
  type: ComponentType;
  prompt: string | null;
  question_id: number | null;
  max_points: string;
}

export interface AssignmentDetail extends Assignment {
  components: AssignmentComponent[];
}

export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  tenant_id: number;
  status: SubmissionStatus;
  submitted_at: Date | null;
  total_score: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubmissionResponse {
  id: number;
  submission_id: number;
  component_id: number;
  text_answer: string | null;
  file_url: string | null;
  url_answer: string | null;
  question_answer: Record<string, unknown> | null;
  is_correct: boolean | null;
}

export interface SubmissionGrade {
  id: number;
  submission_id: number;
  graded_by: number | null;
  overall_feedback: string | null;
  graded_at: Date;
}

export interface SubmissionComponentGrade {
  id: number;
  grade_id: number;
  component_id: number;
  points_awarded: string;
  comment: string | null;
}

export interface SubmissionDetail extends AssignmentSubmission {
  responses: SubmissionResponse[];
  grade: (SubmissionGrade & { component_grades: SubmissionComponentGrade[] }) | null;
}
