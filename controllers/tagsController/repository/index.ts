import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import { CreateTagInput, Tag, TagListQuery } from '../models';

export type CreateTagRequest = CreateTagInput;

const log = createChildLogger('tags-repository');

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
      'SELECT * FROM tags ORDER BY name ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    log.debug({ page, limit, total }, 'findAll tags');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number): Promise<Tag | null> {
    const result = await db.query<Tag>('SELECT * FROM tags WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async create(data: CreateTagRequest): Promise<Tag> {
    const slug = generateSlug(data.name);

    const existing = await db.query<{ id: number }>(
      'SELECT id FROM tags WHERE slug = $1',
      [slug]
    );
    if (existing.rows[0]) throw new Error('Tag already exists');

    const result = await db.query<Tag>(
      'INSERT INTO tags (name, slug) VALUES ($1, $2) RETURNING *',
      [data.name, slug]
    );

    const tag = result.rows[0];
    if (!tag) throw new Error('Failed to create tag');

    log.info({ id: tag.id, slug }, 'Tag created');
    return tag;
  }
}
