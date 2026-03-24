import { z } from 'zod';

// ── Enum literals ──────────────────────────────────────────────────────────────

export const ActivityTypeEnum = z.enum(['quiz', 'survey', 'practice_quiz', 'pdf_book']);
export const CourseStatusEnum = z.enum(['draft', 'published', 'archived']);

export type ActivityType = z.infer<typeof ActivityTypeEnum>;
export type CourseStatus = z.infer<typeof CourseStatusEnum>;

// ── Course schemas ─────────────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  status: CourseStatusEnum.optional().default('draft'),
  thumbnail_url: z.string().url().optional(),
});

export const UpdateCourseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(500).optional(),
  status: CourseStatusEnum.optional(),
  thumbnail_url: z.string().url().optional(),
});

export const CourseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: CourseStatusEnum.optional(),
});

// ── Activity schemas ───────────────────────────────────────────────────────────

// Settings are optional at creation time — the activity is configured after creation
// via the settings panel (UpdateActivity). Strict validation is intentionally deferred
// so that the UI can create a blank activity and let the user fill in settings next.
export const CreateActivitySchema = z.object({
  type: ActivityTypeEnum,
  title: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  position: z.number().int().min(0).default(0),
  settings: z.record(z.string(), z.unknown()).default({}),
});

// Note: `type` is intentionally excluded from UpdateActivitySchema — activity type is
// immutable after creation (changing quiz → pdf_book would silently orphan the old
// settings). If you need type changes, delete and re-create the activity.
// Because type is excluded, settings cross-field validation (item_bank_id / file_url)
// cannot be done here — the original type constraint was enforced at creation time.
export const UpdateActivitySchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(500).optional(),
  position: z.number().int().min(0).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const ReorderActivitiesSchema = z.object({
  ordered_ids: z
    .array(z.number().int().positive())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'ordered_ids must not contain duplicates',
    }),
});

// ── Assignment schemas ─────────────────────────────────────────────────────────

export const CreateAssignmentSchema = z.object({
  user_id: z.number().int().positive(),
  due_at: z.string().datetime({ offset: true }).optional(),
});

// ── TypeScript interfaces (row shapes returned by PostgreSQL) ──────────────────

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;
export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;
export type ReorderActivitiesInput = z.infer<typeof ReorderActivitiesSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export interface Course {
  id: number;
  title: string;
  description: string | null;
  status: CourseStatus;
  thumbnail_url: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Activity {
  id: number;
  course_id: number;
  type: ActivityType;
  title: string;
  description: string | null;
  position: number;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CourseWithActivities extends Course {
  activities: Activity[];
}

export interface CourseAssignment {
  id: number;
  course_id: number;
  user_id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  assigned_by: number | null;
  assigned_at: Date;
  due_date: Date | null;
}
