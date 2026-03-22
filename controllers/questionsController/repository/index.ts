import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import {
  CreateQuestionInput,
  Question,
  QuestionListQuery,
  UpdateQuestionInput,
} from '../models';

export type CreateQuestionRequest = CreateQuestionInput;
export type UpdateQuestionRequest = Omit<UpdateQuestionInput, 'id'>;

const log = createChildLogger('questions-repository');

interface TagRow {
  question_id: number;
  id: number;
  name: string;
  slug: string;
}

export class QuestionsRepository {
  private async fetchTagsForQuestions(
    questionIds: number[]
  ): Promise<Map<number, { id: number; name: string; slug: string }[]>> {
    if (questionIds.length === 0) return new Map();

    const result = await db.query<TagRow>(
      `SELECT qt.question_id, t.id, t.name, t.slug
       FROM question_tags qt
       JOIN tags t ON qt.tag_id = t.id
       WHERE qt.question_id = ANY($1)`,
      [questionIds]
    );

    const map = new Map<number, { id: number; name: string; slug: string }[]>();
    for (const row of result.rows) {
      const { question_id, ...tag } = row;
      const existing = map.get(question_id) ?? [];
      existing.push(tag);
      map.set(question_id, existing);
    }
    return map;
  }

  private async fetchTagsForQuestion(
    client: PoolClient,
    questionId: number
  ): Promise<{ id: number; name: string; slug: string }[]> {
    const result = await client.query<Omit<TagRow, 'question_id'>>(
      `SELECT t.id, t.name, t.slug
       FROM question_tags qt
       JOIN tags t ON qt.tag_id = t.id
       WHERE qt.question_id = $1`,
      [questionId]
    );
    return result.rows;
  }

  private async replaceTagsInTransaction(
    client: PoolClient,
    questionId: number,
    tagIds: number[]
  ): Promise<void> {
    await client.query(
      'DELETE FROM question_tags WHERE question_id = $1',
      [questionId]
    );

    if (tagIds.length > 0) {
      const placeholders = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO question_tags (question_id, tag_id) VALUES ${placeholders}`,
        [questionId, ...tagIds]
      );
    }
  }

  async findAll(
    query: QuestionListQuery,
    userId: number,
    role: string
  ): Promise<{ items: Question[]; total: number; page: number; limit: number }> {
    const { page, limit, type, status, item_bank_id, search } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role === 'user') {
      conditions.push(`owner_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (type !== undefined) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    if (status !== undefined) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (item_bank_id !== undefined) {
      conditions.push(`item_bank_id = $${paramIndex++}`);
      params.push(item_bank_id);
    }

    if (search !== undefined) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR text ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM questions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    // Build the data query params independently — never mutate `params` after
    // the count query, because the test mock captures the array by reference.
    const userParamIdx = paramIndex;
    const dataResult = await db.query<Question>(
      `SELECT q.* FROM questions q
       LEFT JOIN question_order qo
         ON qo.question_id = q.id AND qo.user_id = $${userParamIdx}
       ${whereClause}
       ORDER BY COALESCE(qo.position, 999999), q.created_at DESC
       LIMIT $${userParamIdx + 1} OFFSET $${userParamIdx + 2}`,
      [...params, userId, limit, offset]
    );

    const questions = dataResult.rows;

    if (questions.length > 0) {
      const ids = questions.map((q) => q.id);
      const tagsMap = await this.fetchTagsForQuestions(ids);
      for (const q of questions) {
        q.tags = tagsMap.get(q.id) ?? [];
      }
    }

    log.debug({ page, limit, total, role }, 'findAll questions');
    return { items: questions, total, page, limit };
  }

  async findById(
    id: number,
    userId: number,
    role: string
  ): Promise<Question | null> {
    const queryText =
      role === 'admin'
        ? 'SELECT * FROM questions WHERE id = $1'
        : 'SELECT * FROM questions WHERE id = $1 AND owner_id = $2';

    const queryParams = role === 'admin' ? [id] : [id, userId];

    const result = await db.query<Question>(queryText, queryParams);
    const question = result.rows[0] ?? null;

    if (question) {
      const tagsMap = await this.fetchTagsForQuestions([question.id]);
      question.tags = tagsMap.get(question.id) ?? [];
    }

    return question;
  }

  async create(data: CreateQuestionRequest, ownerId: number): Promise<Question> {
    const { tag_ids, ...fields } = data;
    const resolvedTagIds = tag_ids ?? [];

    return db.transaction(async (client) => {
      const result = await client.query<Question>(
        `INSERT INTO questions (owner_id, name, type, text, mark, item_bank_id, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          ownerId,
          fields.name,
          fields.type,
          fields.text ?? null,
          fields.mark,
          fields.item_bank_id ?? null,
          JSON.stringify(fields.content),
        ]
      );

      const question = result.rows[0];
      if (!question) throw new Error('Failed to create question');

      if (resolvedTagIds.length > 0) {
        const placeholders = resolvedTagIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(', ');
        await client.query(
          `INSERT INTO question_tags (question_id, tag_id) VALUES ${placeholders}`,
          [question.id, ...resolvedTagIds]
        );
      }

      question.tags = await this.fetchTagsForQuestion(client, question.id);

      log.info({ id: question.id, ownerId }, 'Question created');
      return question;
    });
  }

  async update(
    id: number,
    data: UpdateQuestionRequest,
    userId: number,
    role: string
  ): Promise<Question> {
    const existing = await this.findById(id, userId, role);
    if (!existing) throw new Error('Question not found or access denied');

    const { tag_ids, ...fields } = data;

    // Build the SET clause from whichever fields were supplied.
    const updateFields: Record<string, unknown> = {};
    if (fields.name !== undefined) updateFields['name'] = fields.name;
    if (fields.type !== undefined) updateFields['type'] = fields.type;
    if (fields.text !== undefined) updateFields['text'] = fields.text;
    if (fields.mark !== undefined) updateFields['mark'] = fields.mark;
    if (fields.status !== undefined) updateFields['status'] = fields.status;
    if (fields.item_bank_id !== undefined)
      updateFields['item_bank_id'] = fields.item_bank_id;
    if (fields.content !== undefined)
      updateFields['content'] = JSON.stringify(fields.content);

    // Run the question-fields UPDATE as a plain autocommit query — the same
    // pattern used by submitForReview, which is known to persist correctly.
    if (Object.keys(updateFields).length > 0) {
      const setClauses = Object.keys(updateFields).map(
        (col, i) => `${col} = $${i + 2}`
      );
      await db.query(
        `UPDATE questions SET ${setClauses.join(', ')} WHERE id = $1`,
        [id, ...Object.values(updateFields)]
      );
    }

    // Replace tags inside a transaction so the DELETE + INSERT pair is atomic.
    if (tag_ids !== undefined) {
      await db.transaction(async (client) => {
        await this.replaceTagsInTransaction(client, id, tag_ids);
      });
    }

    // Re-fetch the full updated row and its tags.
    const updatedResult = await db.query<Question>(
      'SELECT * FROM questions WHERE id = $1',
      [id]
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new Error('Failed to retrieve updated question');

    const tagsMap = await this.fetchTagsForQuestions([id]);
    updated.tags = tagsMap.get(id) ?? [];

    log.info({ id }, 'Question updated');
    return updated;
  }

  async delete(id: number, userId: number, role: string): Promise<void> {
    const existing = await this.findById(id, userId, role);
    if (!existing) throw new Error('Question not found or access denied');

    await db.query('DELETE FROM questions WHERE id = $1', [id]);
    log.info({ id }, 'Question deleted');
  }

  async submitForReview(id: number, userId: number): Promise<Question> {
    const result = await db.query<Question>(
      'SELECT * FROM questions WHERE id = $1 AND owner_id = $2',
      [id, userId]
    );
    const question = result.rows[0];
    if (!question) throw new Error('Question not found or access denied');
    if (question.status !== 'draft') {
      throw new Error('Only draft questions can be submitted for review');
    }

    const updated = await db.query<Question>(
      `UPDATE questions SET status = 'in_review' WHERE id = $1 RETURNING *`,
      [id]
    );
    const updatedQuestion = updated.rows[0];
    if (!updatedQuestion) throw new Error('Failed to submit question for review');

    const tagsMap = await this.fetchTagsForQuestions([id]);
    updatedQuestion.tags = tagsMap.get(id) ?? [];

    log.info({ id }, 'Question submitted for review');
    return updatedQuestion;
  }

  async publish(id: number): Promise<Question> {
    const result = await db.query<Question>(
      'SELECT * FROM questions WHERE id = $1',
      [id]
    );
    const question = result.rows[0];
    if (!question) throw new Error('Question not found');
    if (question.status !== 'in_review') {
      throw new Error('Only questions in review can be published');
    }

    const updated = await db.query<Question>(
      `UPDATE questions SET status = 'published', rejection_note = NULL
       WHERE id = $1 RETURNING *`,
      [id]
    );
    const updatedQuestion = updated.rows[0];
    if (!updatedQuestion) throw new Error('Failed to publish question');

    const tagsMap = await this.fetchTagsForQuestions([id]);
    updatedQuestion.tags = tagsMap.get(id) ?? [];

    log.info({ id }, 'Question published');
    return updatedQuestion;
  }

  async checkItemBankAccess(
    itemBankId: number,
    userId: number,
    role: string
  ): Promise<void> {
    const result = await db.query<{ owner_id: number }>(
      'SELECT owner_id FROM item_banks WHERE id = $1',
      [itemBankId]
    );
    const itemBank = result.rows[0];
    if (!itemBank) throw new Error('Item bank not found');
    if (role !== 'admin' && Number(itemBank.owner_id) !== userId) {
      throw new Error('You do not have access to this item bank');
    }
  }

  async reject(id: number, note: string): Promise<Question> {
    const result = await db.query<Question>(
      'SELECT * FROM questions WHERE id = $1',
      [id]
    );
    const question = result.rows[0];
    if (!question) throw new Error('Question not found');
    if (question.status !== 'in_review') {
      throw new Error('Only questions in review can be rejected');
    }

    const updated = await db.query<Question>(
      `UPDATE questions SET status = 'draft', rejection_note = $2
       WHERE id = $1 RETURNING *`,
      [id, note]
    );
    const updatedQuestion = updated.rows[0];
    if (!updatedQuestion) throw new Error('Failed to reject question');

    const tagsMap = await this.fetchTagsForQuestions([id]);
    updatedQuestion.tags = tagsMap.get(id) ?? [];

    log.info({ id }, 'Question rejected');
    return updatedQuestion;
  }

  async reorder(questionIds: number[], userId: number, role: string): Promise<void> {
    /**
     * Persist a custom ordering of questions for the user.
     * The frontend sends an array of question IDs in the desired order.
     * Each position is 0-indexed.
     */
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new Error('Invalid question IDs array');
    }

    // Verify user owns all questions in the list (unless they're an admin)
    if (role !== 'admin') {
      const verification = await db.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM questions
         WHERE id = ANY($1) AND owner_id != $2`,
        [questionIds, userId]
      );
      const unauthorizedCount = Number(verification.rows[0]?.count || 0);
      if (unauthorizedCount > 0) {
        throw new Error('You do not have permission to reorder some of these questions');
      }
    }

    // Delete existing order entries for this user
    await db.query('DELETE FROM question_order WHERE user_id = $1', [userId]);

    // Insert new order entries
    const values = questionIds
      .map((id, idx) => `($1, ${id}, ${idx})`)
      .join(', ');

    if (values.trim()) {
      await db.query(
        `INSERT INTO question_order (user_id, question_id, position)
         VALUES ${values}`,
        [userId]
      );
    }

    log.info({ count: questionIds.length, userId }, 'Questions reordered');
  }
}
