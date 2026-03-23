import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: { query: queryMock },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeRow(overrides: Record<string, unknown> = {}) {
  return { id: 1, name: 'Science', parent_id: null, path: [1], ...overrides };
}

describe('CategoriesRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  describe('findAll', () => {
    test('returns flat rows from CTE query', async () => {
      const rows = [makeRow({ id: 1 }), makeRow({ id: 2, parent_id: 1, path: [1, 2] })];
      queryMock.mockResolvedValueOnce({ rows });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.findAll();

      expect(result).toEqual(rows);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('RECURSIVE');
      expect(call?.[0]).toContain('ORDER BY path');
    });
  });

  describe('create', () => {
    test('inserts category with parent_id and returns row', async () => {
      const row = makeRow({ id: 3, name: 'Physics', parent_id: 1 });
      queryMock.mockResolvedValueOnce({ rows: [row] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.create({ name: 'Physics', parent_id: 1, created_by: 7 });

      expect(result).toEqual(row);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('INSERT INTO categories');
      expect(call?.[1]).toEqual(['Physics', 1, 7]);
    });

    test('inserts category without parent_id (null)', async () => {
      const row = makeRow({ id: 4, name: 'History', parent_id: null });
      queryMock.mockResolvedValueOnce({ rows: [row] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await repo.create({ name: 'History', created_by: 7 });

      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual(['History', null, 7]);
    });
  });

  describe('update', () => {
    test('updates name and returns updated row', async () => {
      const row = makeRow({ id: 1, name: 'Updated' });
      queryMock.mockResolvedValueOnce({ rows: [row] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.update(1, 'Updated');

      expect(result).toEqual(row);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('UPDATE categories');
      expect(call?.[1]).toEqual(['Updated', 1]);
    });

    test('throws if category not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await expect(repo.update(999, 'X')).rejects.toThrow('Category not found');
    });
  });

  describe('countChildren', () => {
    test('returns number of child categories', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.countChildren(1);

      expect(result).toBe(3);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('parent_id');
      expect(call?.[1]).toEqual([1]);
    });
  });

  describe('countAssignedQuestions', () => {
    test('returns number of questions in category', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.countAssignedQuestions(1);

      expect(result).toBe(5);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('question_categories');
      expect(call?.[1]).toEqual([1]);
    });
  });

  describe('delete', () => {
    test('throws if category not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await expect(repo.delete(999)).rejects.toThrow('Category not found');
    });

    test('deletes category when found', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [makeRow()] })
        .mockResolvedValueOnce({ rows: [] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await expect(repo.delete(1)).resolves.toBeUndefined();

      const calls = queryMock.mock.calls;
      expect(calls[1]?.[0]).toContain('DELETE FROM categories');
    });
  });

  describe('assignQuestions', () => {
    test('inserts into question_categories with ON CONFLICT DO NOTHING', async () => {
      queryMock.mockResolvedValue({ rows: [] }); // both loop iterations need a resolved value

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await repo.assignQuestions(1, [10, 20]);

      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('ON CONFLICT DO NOTHING');
      expect(call?.[1]).toEqual([1, 10]);
    });

    test('does nothing when question_ids is empty', async () => {
      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await repo.assignQuestions(1, []);

      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('removeQuestion', () => {
    test('deletes from question_categories', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      await repo.removeQuestion(1, 10);

      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('DELETE FROM question_categories');
      expect(call?.[1]).toEqual([1, 10]);
    });
  });

  describe('countOwnedQuestions', () => {
    test('returns count of questions owned by user within given ids', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const { CategoriesRepository } = await import(
        '../../controllers/categoriesController/repository'
      );
      const repo = new CategoriesRepository();
      const result = await repo.countOwnedQuestions(7, [10, 20, 30]);

      expect(result).toBe(2);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('created_by');
      expect(call?.[1]).toEqual([[10, 20, 30], 7]);
    });
  });
});
