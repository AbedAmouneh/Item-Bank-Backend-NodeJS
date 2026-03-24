// controllers/assessmentsController/repository/index.ts
import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import type {
  Assessment,
  AssessmentPoolQuestion,
  Attempt,
  AttemptAnswer,
  AttemptQuestionWithContent,
  CreateAssessmentInput,
  ListAssessmentsQuery,
  UpdateAssessmentInput,
} from '../models';

const log = createChildLogger('assessments-repository');

export class AssessmentsRepository {
  // ─── Assessments ────────────────────────────────────────────────────────────

  async findAll(
    tenantId: number,
    query: ListAssessmentsQuery,
  ): Promise<{ items: Assessment[]; total: number; page: number; limit: number }> {
    const { page, limit, status, type, course_id } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['a.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (status !== undefined) {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    }
    if (type !== undefined) {
      conditions.push(`a.type = $${idx++}`);
      params.push(type);
    }
    if (course_id !== undefined) {
      conditions.push(`a.course_id = $${idx++}`);
      params.push(course_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM assessments a ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<Assessment>(
      `SELECT a.*
       FROM assessments a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    log.debug({ page, limit, total }, 'findAll assessments');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number, tenantId: number): Promise<Assessment | null> {
    const result = await db.query<Assessment>(
      'SELECT * FROM assessments WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(
    data: CreateAssessmentInput,
    createdBy: number,
    tenantId: number,
  ): Promise<Assessment> {
    const result = await db.query<Assessment>(
      `INSERT INTO assessments
         (tenant_id, course_id, created_by, title, description, type,
          time_limit_mins, max_attempts, passing_score_percent,
          question_count, randomize_questions, anti_cheat_enabled, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        tenantId,
        data.course_id ?? null,
        createdBy,
        data.title,
        data.description ?? null,
        data.type,
        data.time_limit_mins ?? null,
        data.max_attempts,
        data.passing_score_percent,
        data.question_count,
        data.randomize_questions,
        data.anti_cheat_enabled,
        data.status,
      ],
    );
    const assessment = result.rows[0];
    if (!assessment) throw new Error('Failed to create assessment');
    log.info({ id: assessment.id }, 'Assessment created');
    return assessment;
  }

  async update(
    id: number,
    data: UpdateAssessmentInput,
    tenantId: number,
  ): Promise<Assessment | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined)                { fields.push(`title = $${idx++}`);                params.push(data.title); }
    if (data.description !== undefined)          { fields.push(`description = $${idx++}`);          params.push(data.description); }
    if (data.type !== undefined)                 { fields.push(`type = $${idx++}`);                 params.push(data.type); }
    if (data.course_id !== undefined)            { fields.push(`course_id = $${idx++}`);            params.push(data.course_id); }
    if (data.time_limit_mins !== undefined)      { fields.push(`time_limit_mins = $${idx++}`);      params.push(data.time_limit_mins); }
    if (data.max_attempts !== undefined)         { fields.push(`max_attempts = $${idx++}`);         params.push(data.max_attempts); }
    if (data.passing_score_percent !== undefined){ fields.push(`passing_score_percent = $${idx++}`);params.push(data.passing_score_percent); }
    if (data.question_count !== undefined)       { fields.push(`question_count = $${idx++}`);       params.push(data.question_count); }
    if (data.randomize_questions !== undefined)  { fields.push(`randomize_questions = $${idx++}`);  params.push(data.randomize_questions); }
    if (data.anti_cheat_enabled !== undefined)   { fields.push(`anti_cheat_enabled = $${idx++}`);   params.push(data.anti_cheat_enabled); }
    if (data.status !== undefined)               { fields.push(`status = $${idx++}`);               params.push(data.status); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push('updated_at = NOW()');
    params.push(id, tenantId);

    const result = await db.query<Assessment>(
      `UPDATE assessments
       SET ${fields.join(', ')}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  async archive(id: number, tenantId: number): Promise<boolean> {
    const result = await db.query(
      `UPDATE assessments SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Question pool ───────────────────────────────────────────────────────────

  async getPool(
    assessmentId: number,
    tenantId: number,
  ): Promise<AssessmentPoolQuestion[]> {
    const result = await db.query<AssessmentPoolQuestion>(
      `SELECT aqp.id, aqp.assessment_id, aqp.question_id, aqp.added_at,
              q.name, q.type
       FROM assessment_question_pool aqp
       JOIN questions q ON q.id = aqp.question_id
       JOIN assessments a ON a.id = aqp.assessment_id
       WHERE aqp.assessment_id = $1
         AND a.tenant_id = $2
       ORDER BY aqp.added_at ASC`,
      [assessmentId, tenantId],
    );
    return result.rows;
  }

  async addToPool(assessmentId: number, questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;
    const values = questionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await db.query(
      `INSERT INTO assessment_question_pool (assessment_id, question_id)
       VALUES ${values}
       ON CONFLICT (assessment_id, question_id) DO NOTHING`,
      [assessmentId, ...questionIds],
    );
    log.info({ assessmentId, count: questionIds.length }, 'Questions added to pool');
  }

  async removeFromPool(assessmentId: number, questionId: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM assessment_question_pool WHERE assessment_id = $1 AND question_id = $2',
      [assessmentId, questionId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Attempts ───────────────────────────────────────────────────────────────

  async countAttempts(assessmentId: number, userId: number): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM attempts WHERE assessment_id = $1 AND user_id = $2 AND status = \'submitted\'',
      [assessmentId, userId],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async createAttempt(
    assessmentId: number,
    userId: number,
    tenantId: number,
    attemptNumber: number,
    deadlineAt: Date | null,
  ): Promise<Attempt> {
    const result = await db.query<Attempt>(
      `INSERT INTO attempts (assessment_id, user_id, tenant_id, attempt_number, deadline_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [assessmentId, userId, tenantId, attemptNumber, deadlineAt],
    );
    const attempt = result.rows[0];
    if (!attempt) throw new Error('Failed to create attempt');
    return attempt;
  }

  async drawQuestions(
    assessmentId: number,
    count: number,
    randomize: boolean,
  ): Promise<number[]> {
    // orderBy is derived from a boolean — not user input — so interpolation is safe
    const orderBy = randomize ? 'RANDOM()' : 'aqp.added_at ASC';
    const result = await db.query<{ question_id: number }>(
      `SELECT question_id
       FROM assessment_question_pool aqp
       WHERE aqp.assessment_id = $1
       ORDER BY ${orderBy}
       LIMIT $2`,
      [assessmentId, count],
    );
    return result.rows.map(r => r.question_id);
  }

  async insertAttemptQuestions(attemptId: number, questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;
    // For questionIds=[101,102,103]: ($1,$2,$3), ($1,$4,$5), ($1,$6,$7)
    // params=[attemptId, 101,1, 102,2, 103,3]
    const placeholders = questionIds
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      .join(', ');
    const params: unknown[] = [attemptId];
    questionIds.forEach((qId, i) => {
      params.push(qId, i + 1);
    });
    await db.query(
      `INSERT INTO attempt_questions (attempt_id, question_id, position) VALUES ${placeholders}`,
      params,
    );
  }

  async getAttempt(
    attemptId: number,
    userId: number,
    tenantId: number,
  ): Promise<Attempt | null> {
    const result = await db.query<Attempt>(
      'SELECT * FROM attempts WHERE id = $1 AND user_id = $2 AND tenant_id = $3',
      [attemptId, userId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async isQuestionInAttempt(attemptId: number, questionId: number): Promise<boolean> {
    const result = await db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM attempt_questions
         WHERE attempt_id = $1 AND question_id = $2
       ) AS exists`,
      [attemptId, questionId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async getAttemptQuestionsWithContent(attemptId: number): Promise<AttemptQuestionWithContent[]> {
    const result = await db.query<AttemptQuestionWithContent>(
      `SELECT aq.question_id, aq.position, q.type, q.content
       FROM attempt_questions aq
       JOIN questions q ON q.id = aq.question_id
       WHERE aq.attempt_id = $1
       ORDER BY aq.position ASC`,
      [attemptId],
    );
    return result.rows;
  }

  async getAttemptAnswers(attemptId: number): Promise<AttemptAnswer[]> {
    const result = await db.query<AttemptAnswer>(
      'SELECT * FROM attempt_answers WHERE attempt_id = $1',
      [attemptId],
    );
    return result.rows;
  }

  async upsertAnswer(
    attemptId: number,
    questionId: number,
    answer: Record<string, unknown>,
  ): Promise<void> {
    await db.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, answer, saved_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET answer = EXCLUDED.answer, saved_at = NOW()`,
      [attemptId, questionId, JSON.stringify(answer)],
    );
  }

  async finalizeAttempt(
    attemptId: number,
    scores: Array<{ questionId: number; isCorrect: boolean | null; pointsAwarded: number }>,
    scorePercent: number,
    passed: boolean,
  ): Promise<Attempt> {
    let finalAttempt: Attempt | undefined;

    await db.transaction(async (client: PoolClient) => {
      for (const score of scores) {
        await client.query(
          `UPDATE attempt_answers
           SET is_correct = $1, points_awarded = $2
           WHERE attempt_id = $3 AND question_id = $4`,
          [score.isCorrect, score.pointsAwarded, attemptId, score.questionId],
        );
      }

      const result = await client.query<Attempt>(
        `UPDATE attempts
         SET status = 'submitted',
             submitted_at = NOW(),
             updated_at = NOW(),
             score_percent = $1,
             passed = $2
         WHERE id = $3
         RETURNING *`,
        [scorePercent, passed, attemptId],
      );
      finalAttempt = result.rows[0];
    });

    if (!finalAttempt) throw new Error('Failed to finalize attempt');
    log.info({ attemptId, scorePercent, passed }, 'Attempt finalized');
    return finalAttempt;
  }

  async getAttemptResult(
    attemptId: number,
    userId: number,
    tenantId: number,
  ): Promise<{
    attempt: Attempt;
    answers: AttemptAnswer[];
    total_questions: number;
  } | null> {
    const attemptResult = await db.query<Attempt>(
      'SELECT * FROM attempts WHERE id = $1 AND user_id = $2 AND tenant_id = $3',
      [attemptId, userId, tenantId],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) return null;

    const answersResult = await db.query<AttemptAnswer>(
      'SELECT * FROM attempt_answers WHERE attempt_id = $1 ORDER BY question_id ASC',
      [attemptId],
    );

    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM attempt_questions WHERE attempt_id = $1',
      [attemptId],
    );

    return {
      attempt,
      answers: answersResult.rows,
      total_questions: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  async logViolation(attemptId: number, violationType: string): Promise<void> {
    await db.query(
      'INSERT INTO attempt_violations (attempt_id, violation_type) VALUES ($1, $2)',
      [attemptId, violationType],
    );
  }
}
