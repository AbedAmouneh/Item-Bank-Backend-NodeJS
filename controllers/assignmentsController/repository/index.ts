// controllers/assignmentsController/repository/index.ts
import { PoolClient } from 'pg';
import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import {
  Assignment,
  AssignmentComponent,
  AssignmentDetail,
  AssignmentSubmission,
  ComponentInput,
  CreateAssignmentInput,
  ListAssignmentsQuery,
  SubmissionComponentGrade,
  SubmissionDetail,
  SubmissionGrade,
  SubmissionResponse,
  UpdateAssignmentInput,
} from '../models';

const log = createChildLogger('assignments-repository');

interface QuestionRow {
  id: number;
  type: string;
  content: Record<string, unknown>;
}

export class AssignmentsRepository {
  // ─── Assignments ──────────────────────────────────────────────────────────

  async findAll(
    tenantId: number,
    userId: number,
    roles: string[],
    query: ListAssignmentsQuery,
  ): Promise<{ items: Assignment[]; total: number; page: number; limit: number }> {
    const { page, limit, status, course_id } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['a.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    const isLearner = !roles.includes('teacher') && !roles.includes('org_admin');
    if (isLearner) {
      conditions.push(
        `EXISTS (SELECT 1 FROM assignment_user_assignments au WHERE au.assignment_id = a.id AND au.user_id = $${idx++})`,
      );
      params.push(userId);
    } else if (roles.includes('teacher') && !roles.includes('org_admin')) {
      conditions.push(`a.created_by = $${idx++}`);
      params.push(userId);
    }

    if (status !== undefined) {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    }
    if (course_id !== undefined) {
      conditions.push(`a.course_id = $${idx++}`);
      params.push(course_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM assignments a ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<Assignment>(
      `SELECT a.* FROM assignments a ${where} ORDER BY a.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    log.debug({ page, limit, total }, 'findAll assignments');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number, tenantId: number): Promise<AssignmentDetail | null> {
    const result = await db.query<Assignment>(
      'SELECT * FROM assignments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    const assignment = result.rows[0];
    if (!assignment) return null;
    const components = await this.findComponents(id);
    return { ...assignment, components };
  }

  async create(data: CreateAssignmentInput, createdBy: number, tenantId: number): Promise<AssignmentDetail> {
    return db.transaction(async (client) => {
      const aResult = await client.query<Assignment>(
        `INSERT INTO assignments (tenant_id, course_id, created_by, title, instructions, max_score, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenantId, data.course_id ?? null, createdBy, data.title, data.instructions ?? null,
         data.max_score, data.due_date ?? null, data.status],
      );
      const assignment = aResult.rows[0];
      if (!assignment) throw new Error('Failed to create assignment');
      const components = await this.insertComponents(client, assignment.id, data.components);
      log.info({ id: assignment.id }, 'Assignment created');
      return { ...assignment, components };
    });
  }

  async update(id: number, data: UpdateAssignmentInput, tenantId: number): Promise<AssignmentDetail | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) { fields.push(`title = $${idx++}`); params.push(data.title); }
    if (data.instructions !== undefined) { fields.push(`instructions = $${idx++}`); params.push(data.instructions); }
    if (data.max_score !== undefined) { fields.push(`max_score = $${idx++}`); params.push(data.max_score); }
    if (data.due_date !== undefined) { fields.push(`due_date = $${idx++}`); params.push(data.due_date); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); params.push(data.status); }
    if (data.course_id !== undefined) { fields.push(`course_id = $${idx++}`); params.push(data.course_id); }

    return db.transaction(async (client) => {
      let assignment: Assignment | undefined;

      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        params.push(id, tenantId);
        const aResult = await client.query<Assignment>(
          `UPDATE assignments SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
          params,
        );
        assignment = aResult.rows[0];
        if (!assignment) return null;
      } else {
        const aResult = await client.query<Assignment>(
          'SELECT * FROM assignments WHERE id = $1 AND tenant_id = $2',
          [id, tenantId],
        );
        assignment = aResult.rows[0];
        if (!assignment) return null;
      }

      let components: AssignmentComponent[];
      if (data.components !== undefined) {
        await client.query('DELETE FROM assignment_components WHERE assignment_id = $1', [id]);
        components = await this.insertComponents(client, id, data.components);
      } else {
        components = await this.findComponents(id);
      }

      return { ...assignment, components };
    });
  }

  async archive(id: number, tenantId: number): Promise<boolean> {
    const result = await db.query(
      `UPDATE assignments SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async assignUsers(assignmentId: number, userIds: number[], assignedBy: number): Promise<void> {
    for (const userId of userIds) {
      await db.query(
        `INSERT INTO assignment_user_assignments (assignment_id, user_id, assigned_by)
         VALUES ($1, $2, $3) ON CONFLICT (assignment_id, user_id) DO NOTHING`,
        [assignmentId, userId, assignedBy],
      );
    }
    log.info({ assignmentId, count: userIds.length }, 'Users assigned');
  }

  async unassignUser(assignmentId: number, userId: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM assignment_user_assignments WHERE assignment_id = $1 AND user_id = $2',
      [assignmentId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Submissions ──────────────────────────────────────────────────────────

  async findSubmissions(
    assignmentId: number,
    tenantId: number,
    userId: number,
    roles: string[],
  ): Promise<AssignmentSubmission[]> {
    const isLearner = !roles.includes('teacher') && !roles.includes('org_admin');
    const params: unknown[] = [assignmentId, tenantId];
    let extra = '';
    if (isLearner) {
      extra = ' AND s.user_id = $3';
      params.push(userId);
    }
    const result = await db.query<AssignmentSubmission>(
      `SELECT s.* FROM assignment_submissions s
       WHERE s.assignment_id = $1 AND s.tenant_id = $2${extra}
       ORDER BY s.created_at DESC`,
      params,
    );
    return result.rows;
  }

  async findSubmissionById(
    subId: number,
    assignmentId: number,
    tenantId: number,
  ): Promise<SubmissionDetail | null> {
    const sResult = await db.query<AssignmentSubmission>(
      'SELECT * FROM assignment_submissions WHERE id = $1 AND assignment_id = $2 AND tenant_id = $3',
      [subId, assignmentId, tenantId],
    );
    const submission = sResult.rows[0];
    if (!submission) return null;

    const rResult = await db.query<SubmissionResponse>(
      'SELECT * FROM submission_responses WHERE submission_id = $1 ORDER BY component_id',
      [submission.id],
    );
    const gResult = await db.query<SubmissionGrade>(
      'SELECT * FROM submission_grades WHERE submission_id = $1',
      [submission.id],
    );
    const grade = gResult.rows[0] ?? null;

    let componentGrades: SubmissionComponentGrade[] = [];
    if (grade) {
      const cgResult = await db.query<SubmissionComponentGrade>(
        'SELECT * FROM submission_component_grades WHERE grade_id = $1',
        [grade.id],
      );
      componentGrades = cgResult.rows;
    }

    return {
      ...submission,
      responses: rResult.rows,
      grade: grade ? { ...grade, component_grades: componentGrades } : null,
    };
  }

  async findSubmissionByUser(assignmentId: number, userId: number): Promise<AssignmentSubmission | null> {
    const result = await db.query<AssignmentSubmission>(
      'SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND user_id = $2',
      [assignmentId, userId],
    );
    return result.rows[0] ?? null;
  }

  async upsertSubmission(
    assignmentId: number,
    userId: number,
    tenantId: number,
    status: 'draft' | 'submitted',
    submittedAt: Date | null,
  ): Promise<AssignmentSubmission> {
    const result = await db.query<AssignmentSubmission>(
      `INSERT INTO assignment_submissions (assignment_id, user_id, tenant_id, status, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (assignment_id, user_id) DO UPDATE
         SET status = EXCLUDED.status, submitted_at = EXCLUDED.submitted_at, updated_at = NOW()
       RETURNING *`,
      [assignmentId, userId, tenantId, status, submittedAt],
    );
    const submission = result.rows[0];
    if (!submission) throw new Error('Failed to upsert submission');
    return submission;
  }

  async upsertResponse(
    submissionId: number,
    componentId: number,
    data: {
      text_answer?: string;
      file_url?: string;
      url_answer?: string;
      question_answer?: Record<string, unknown>;
      is_correct?: boolean | null;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO submission_responses
         (submission_id, component_id, text_answer, file_url, url_answer, question_answer, is_correct)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (submission_id, component_id) DO UPDATE
         SET text_answer = EXCLUDED.text_answer, file_url = EXCLUDED.file_url,
             url_answer = EXCLUDED.url_answer, question_answer = EXCLUDED.question_answer,
             is_correct = EXCLUDED.is_correct`,
      [
        submissionId, componentId,
        data.text_answer ?? null, data.file_url ?? null, data.url_answer ?? null,
        data.question_answer !== undefined ? JSON.stringify(data.question_answer) : null,
        data.is_correct ?? null,
      ],
    );
  }

  async upsertGrade(
    submissionId: number,
    gradedBy: number,
    overallFeedback: string | undefined,
  ): Promise<SubmissionGrade> {
    const result = await db.query<SubmissionGrade>(
      `INSERT INTO submission_grades (submission_id, graded_by, overall_feedback, graded_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (submission_id) DO UPDATE
         SET graded_by = EXCLUDED.graded_by, overall_feedback = EXCLUDED.overall_feedback, graded_at = NOW()
       RETURNING *`,
      [submissionId, gradedBy, overallFeedback ?? null],
    );
    const grade = result.rows[0];
    if (!grade) throw new Error('Failed to upsert grade');
    return grade;
  }

  async upsertComponentGrade(
    gradeId: number,
    componentId: number,
    pointsAwarded: number,
    comment: string | undefined,
  ): Promise<void> {
    await db.query(
      `INSERT INTO submission_component_grades (grade_id, component_id, points_awarded, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (grade_id, component_id) DO UPDATE
         SET points_awarded = EXCLUDED.points_awarded, comment = EXCLUDED.comment`,
      [gradeId, componentId, pointsAwarded, comment ?? null],
    );
  }

  async updateSubmissionScore(submissionId: number, totalScore: number): Promise<void> {
    await db.query(
      `UPDATE assignment_submissions SET total_score = $1, status = 'graded', updated_at = NOW() WHERE id = $2`,
      [totalScore, submissionId],
    );
  }

  async findComponents(assignmentId: number): Promise<AssignmentComponent[]> {
    const result = await db.query<AssignmentComponent>(
      'SELECT * FROM assignment_components WHERE assignment_id = $1 ORDER BY position',
      [assignmentId],
    );
    return result.rows;
  }

  async findQuestionsByIds(questionIds: number[]): Promise<QuestionRow[]> {
    if (questionIds.length === 0) return [];
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query<QuestionRow>(
      `SELECT id, type, content FROM questions WHERE id IN (${placeholders})`,
      questionIds,
    );
    return result.rows;
  }

  private async insertComponents(
    client: PoolClient,
    assignmentId: number,
    components: ComponentInput[],
  ): Promise<AssignmentComponent[]> {
    const rows: AssignmentComponent[] = [];
    for (const [i, comp] of components.entries()) {
      const r = await client.query<AssignmentComponent>(
        `INSERT INTO assignment_components (assignment_id, position, type, prompt, question_id, max_points)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [assignmentId, comp.position ?? i, comp.type, comp.prompt ?? null, comp.question_id ?? null, comp.max_points],
      );
      if (r.rows[0]) rows.push(r.rows[0]);
    }
    return rows;
  }
}
