import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeTag(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Mathematics',
    slug: 'mathematics',
    created_at: new Date(),
    ...overrides,
  };
}

describe('TagsRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  describe('findAll', () => {
    test('returns paginated tags with total count', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [makeTag({ id: 1 }), makeTag({ id: 2 })] });

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);

      const [countCall, dataCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('SELECT COUNT(*) as count FROM tags');
      expect(dataCall?.[0]).toContain('ORDER BY name ASC');
      expect(dataCall?.[1]).toEqual([10, 0]); // limit, offset
    });

    test('calculates correct offset for page 2', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      await repo.findAll({ page: 2, limit: 5 });

      const [, dataCall] = queryMock.mock.calls;
      expect(dataCall?.[1]).toEqual([5, 5]); // limit=5, offset=(2-1)*5=5
    });
  });

  describe('findById', () => {
    test('returns tag when found', async () => {
      const tag = makeTag();
      queryMock.mockResolvedValueOnce({ rows: [tag] });

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.findById(1);

      expect(result).toEqual(tag);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM tags WHERE id = $1',
        [1]
      );
    });

    test('returns null when tag not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    test('returns empty array immediately when ids list is empty', async () => {
      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.findByIds([]);

      expect(result).toEqual([]);
      expect(queryMock).not.toHaveBeenCalled();
    });

    test('queries with ANY for multiple ids', async () => {
      const tags = [makeTag({ id: 1 }), makeTag({ id: 2 }), makeTag({ id: 3 })];
      queryMock.mockResolvedValueOnce({ rows: tags });

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.findByIds([1, 2, 3]);

      expect(result).toEqual(tags);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM tags WHERE id = ANY($1)',
        [[1, 2, 3]]
      );
    });
  });

  describe('create', () => {
    test('creates tag and returns it when slug is unique', async () => {
      const tag = makeTag();
      queryMock
        .mockResolvedValueOnce({ rows: [] })      // slug check — no conflict
        .mockResolvedValueOnce({ rows: [tag] });  // INSERT

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      const result = await repo.create({ name: 'Mathematics', slug: 'mathematics' });

      expect(result).toEqual(tag);
      const slugCheckCall = queryMock.mock.calls[0];
      expect(slugCheckCall?.[0]).toContain('SELECT id FROM tags WHERE slug = $1');
      expect(slugCheckCall?.[1]).toEqual(['mathematics']);
    });

    test('throws when slug already exists', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // slug already taken

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();

      await expect(
        repo.create({ name: 'Mathematics', slug: 'mathematics' })
      ).rejects.toThrow('A tag with this slug already exists');

      expect(queryMock).toHaveBeenCalledTimes(1); // only slug check, no INSERT
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })  // slug check — unique
        .mockResolvedValueOnce({ rows: [] }); // INSERT returns nothing

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();

      await expect(
        repo.create({ name: 'Mathematics', slug: 'mathematics' })
      ).rejects.toThrow('Failed to create tag');
    });
  });

  describe('delete', () => {
    test('deletes tag when it exists', async () => {
      const tag = makeTag();
      queryMock
        .mockResolvedValueOnce({ rows: [tag] })   // findById
        .mockResolvedValueOnce({ rowCount: 1 });  // DELETE

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();
      await repo.delete(1);

      expect(queryMock).toHaveBeenCalledTimes(2);
      const deleteCall = queryMock.mock.calls[1];
      expect(deleteCall?.[0]).toContain('DELETE FROM tags WHERE id = $1');
      expect(deleteCall?.[1]).toEqual([1]);
    });

    test('throws when tag does not exist', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      const { TagsRepository } = await import(
        '../../controllers/tagsController/repository'
      );
      const repo = new TagsRepository();

      await expect(repo.delete(999)).rejects.toThrow('Tag not found');
      expect(queryMock).toHaveBeenCalledTimes(1); // only findById, no DELETE
    });
  });
});
