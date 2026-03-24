import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import { CreateTagInput, Tag, TagListQuery } from '../models';

export type CreateTagRequest = CreateTagInput;

const log = createChildLogger('tags-repository');

export class TagsRepository {
  async findAll(
    query: TagListQuery
  ): Promise<{ items: Tag[]; total: number; page: number; limit: number }> {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tags'
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<Tag>(
      `SELECT t.id, t.name, t.slug, t.created_at,
         COUNT(qt.question_id)::int AS question_count
       FROM tags t
       LEFT JOIN question_tags qt ON t.id = qt.tag_id
       GROUP BY t.id
       ORDER BY t.name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    log.debug({ page, limit, total }, 'findAll tags');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number): Promise<Tag | null> {
    const result = await db.query<Tag>('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByIds(ids: number[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    const result = await db.query<Tag>(
      'SELECT * FROM tags WHERE id = ANY($1)',
      [ids]
    );
    return result.rows;
  }

  async create(data: CreateTagRequest): Promise<Tag> {
    const existing = await db.query<{ id: number }>(
      'SELECT id FROM tags WHERE slug = $1',
      [data.slug]
    );
    if (existing.rows[0]) throw new Error('A tag with this slug already exists');

    const result = await db.query<Tag>(
      'INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *',
      [data.name, data.slug]
    );

    const tag = result.rows[0];
    if (!tag) throw new Error('Failed to create tag');

    log.info({ id: tag.id, slug: data.slug }, 'Tag created');
    return tag;
  }

  async checkUsage(id: number): Promise<number> {
    const result = await db.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM question_tags WHERE tag_id = $1',
      [id]
    );
    return result.rows[0]?.count ?? 0;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Tag not found');

    await db.query('DELETE FROM tags WHERE id = $1', [id]);
    log.info({ id }, 'Tag deleted');
  }
}
