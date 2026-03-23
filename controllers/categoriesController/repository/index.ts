import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import { FlatCategoryRow } from '../models';

export interface CreateCategoryRequest {
  name: string;
  parent_id?: number;
  created_by: number;
}

const log = createChildLogger('categories-repository');

export class CategoriesRepository {
  async findAll(): Promise<FlatCategoryRow[]> {
    const result = await db.query<FlatCategoryRow>(
      `WITH RECURSIVE tree AS (
        SELECT id, name, parent_id, ARRAY[id] AS path
        FROM categories WHERE parent_id IS NULL
        UNION ALL
        SELECT c.id, c.name, c.parent_id, tree.path || c.id
        FROM categories c JOIN tree ON c.parent_id = tree.id
      ) SELECT * FROM tree ORDER BY path`
    );
    return result.rows;
  }

  async create(data: CreateCategoryRequest): Promise<FlatCategoryRow> {
    const result = await db.query<FlatCategoryRow>(
      `INSERT INTO categories (name, parent_id, created_by) VALUES ($1, $2, $3)
       RETURNING id, name, parent_id, ARRAY[id] AS path`,
      [data.name, data.parent_id ?? null, data.created_by]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Failed to create category');
    log.info({ id: row.id }, 'Category created');
    return row;
  }

  async update(id: number, name: string): Promise<FlatCategoryRow> {
    const result = await db.query<FlatCategoryRow>(
      `UPDATE categories SET name = $1 WHERE id = $2
       RETURNING id, name, parent_id, ARRAY[id] AS path`,
      [name, id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Category not found');
    log.info({ id }, 'Category updated');
    return row;
  }

  async countChildren(id: number): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM categories WHERE parent_id = $1',
      [id]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async countAssignedQuestions(id: number): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM question_categories WHERE category_id = $1',
      [id]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async findById(id: number): Promise<FlatCategoryRow | null> {
    const result = await db.query<FlatCategoryRow>(
      'SELECT id, name, parent_id, ARRAY[id] AS path FROM categories WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Category not found');
    await db.query('DELETE FROM categories WHERE id = $1', [id]);
    log.info({ id }, 'Category deleted');
  }

  async assignQuestions(categoryId: number, questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;
    for (const qid of questionIds) {
      await db.query(
        'INSERT INTO question_categories (category_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [categoryId, qid]
      );
    }
  }

  async removeQuestion(categoryId: number, questionId: number): Promise<void> {
    await db.query(
      'DELETE FROM question_categories WHERE category_id = $1 AND question_id = $2',
      [categoryId, questionId]
    );
  }

  async countOwnedQuestions(userId: number, questionIds: number[]): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM questions WHERE id = ANY($1) AND created_by = $2',
      [questionIds, userId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }
}
