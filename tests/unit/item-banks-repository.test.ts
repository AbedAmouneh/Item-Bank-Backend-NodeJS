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

function makeItemBank(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    owner_id: 10,
    name: 'Test Bank',
    description: null,
    is_active: true,
    question_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('ItemBanksRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  describe('findAll', () => {
    test('returns all banks for admin without owner filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [makeItemBank({ id: 1 }), makeItemBank({ id: 2 }), makeItemBank({ id: 3 })] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.findAll(10, 'admin', { page: 1, limit: 20 });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).not.toContain('owner_id');
    });

    test('filters by owner_id for regular user', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeItemBank()] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.findAll(10, 'user', { page: 1, limit: 20 });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('owner_id = $1');
      expect(countCall?.[1]).toContain(10);
    });

    test('applies search filter with ILIKE and wraps in %', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeItemBank()] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.findAll(10, 'admin', { page: 1, limit: 20, search: 'math' });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('ILIKE');
      expect(countCall?.[1]).toContain('%math%');
    });

    test('always includes is_active = true filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.findAll(10, 'admin', { page: 1, limit: 20 });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('is_active = true');
    });
  });

  describe('findById', () => {
    test('uses a single id param for admin (no owner check)', async () => {
      const bank = makeItemBank();
      queryMock.mockResolvedValueOnce({ rows: [bank] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.findById(1, 10, 'admin');

      expect(result).toEqual(bank);
      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual([1]); // only id, no userId
      expect(call?.[0]).not.toContain('owner_id');
    });

    test('includes owner_id param for regular user', async () => {
      const bank = makeItemBank();
      queryMock.mockResolvedValueOnce({ rows: [bank] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.findById(1, 10, 'user');

      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual([1, 10]);
      expect(call?.[0]).toContain('owner_id');
    });

    test('returns null when not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.findById(999, 10, 'admin');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('inserts and returns item bank with question_count hardcoded to 0', async () => {
      const dbRow = { id: 1, owner_id: 10, name: 'Test Bank', description: null, is_active: true, created_at: new Date(), updated_at: new Date() };
      queryMock.mockResolvedValueOnce({ rows: [dbRow] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.create({ name: 'Test Bank' }, 10);

      expect(result.question_count).toBe(0);
      expect(result.name).toBe('Test Bank');
      const [insertCall] = queryMock.mock.calls;
      expect(insertCall?.[0]).toContain('INSERT INTO item_banks');
      expect(insertCall?.[1]).toEqual([10, 'Test Bank', null]); // ownerId, name, null description
    });

    test('passes description when provided', async () => {
      const dbRow = { id: 1, owner_id: 10, name: 'Test Bank', description: 'A description', is_active: true, created_at: new Date(), updated_at: new Date() };
      queryMock.mockResolvedValueOnce({ rows: [dbRow] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.create({ name: 'Test Bank', description: 'A description' }, 10);

      const [insertCall] = queryMock.mock.calls;
      expect(insertCall?.[1]).toEqual([10, 'Test Bank', 'A description']);
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();

      await expect(repo.create({ name: 'Test Bank' }, 10)).rejects.toThrow(
        'Failed to create item bank'
      );
    });
  });

  describe('update', () => {
    test('fetches existing, runs UPDATE, then re-fetches', async () => {
      const existing = makeItemBank();
      const updated = makeItemBank({ name: 'New Name' });
      queryMock
        .mockResolvedValueOnce({ rows: [existing] }) // first findById (existence check)
        .mockResolvedValueOnce({ rowCount: 1 })      // UPDATE
        .mockResolvedValueOnce({ rows: [updated] }); // second findById (re-fetch)

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.update(1, { name: 'New Name' }, 10, 'admin');

      expect(result.name).toBe('New Name');
      expect(queryMock).toHaveBeenCalledTimes(3);
      const updateCall = queryMock.mock.calls[1];
      expect(updateCall?.[0]).toContain('UPDATE item_banks SET');
    });

    test('skips UPDATE query but still re-fetches when no fields are provided', async () => {
      const bank = makeItemBank();
      queryMock
        .mockResolvedValueOnce({ rows: [bank] }) // first findById
        .mockResolvedValueOnce({ rows: [bank] }); // re-fetch findById

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      const result = await repo.update(1, {}, 10, 'admin');

      expect(result).toEqual(bank);
      expect(queryMock).toHaveBeenCalledTimes(2); // no UPDATE call in the middle
    });

    test('throws when item bank is not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();

      await expect(
        repo.update(999, { name: 'X' }, 10, 'admin')
      ).rejects.toThrow('Item bank not found or access denied');
    });
  });

  describe('softDelete', () => {
    test('sets is_active = false when item bank exists', async () => {
      const bank = makeItemBank();
      queryMock
        .mockResolvedValueOnce({ rows: [bank] }) // findById
        .mockResolvedValueOnce({ rowCount: 1 });  // UPDATE

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();
      await repo.softDelete(1, 10, 'admin');

      expect(queryMock).toHaveBeenCalledTimes(2);
      const updateCall = queryMock.mock.calls[1];
      expect(updateCall?.[0]).toContain('SET is_active = false');
      expect(updateCall?.[1]).toEqual([1]);
    });

    test('throws when item bank is not found or not owned', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      const { ItemBanksRepository } = await import(
        '../../controllers/itemBanksController/repository'
      );
      const repo = new ItemBanksRepository();

      await expect(repo.softDelete(999, 10, 'user')).rejects.toThrow(
        'Item bank not found or access denied'
      );
    });
  });
});
