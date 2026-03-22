import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ItemBanksService, PermissionError } from '../../controllers/itemBanksController/service';

const {
  mockFindAll,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockSoftDelete,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSoftDelete: vi.fn(),
}));

vi.mock('../../controllers/itemBanksController/repository', () => ({
  ItemBanksRepository: function () {
    return {
      findAll: mockFindAll,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      softDelete: mockSoftDelete,
    };
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

describe('ItemBanksService', () => {
  let service: ItemBanksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ItemBanksService();
  });

  describe('findAll', () => {
    test('delegates to repository and returns result', async () => {
      const expected = { items: [makeItemBank()], total: 1, page: 1, limit: 20 };
      mockFindAll.mockResolvedValue(expected);

      const result = await service.findAll(10, 'admin', { page: 1, limit: 20 });

      expect(result).toEqual(expected);
      expect(mockFindAll).toHaveBeenCalledWith(10, 'admin', { page: 1, limit: 20 });
    });

    test('passes userId and role through to repository', async () => {
      mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await service.findAll(42, 'user', { page: 1, limit: 20 });

      expect(mockFindAll).toHaveBeenCalledWith(42, 'user', { page: 1, limit: 20 });
    });
  });

  describe('findById', () => {
    test('returns item bank when found', async () => {
      const bank = makeItemBank();
      mockFindById.mockResolvedValue(bank);

      const result = await service.findById(1, 10, 'user');

      expect(result).toEqual(bank);
      expect(mockFindById).toHaveBeenCalledWith(1, 10, 'user');
    });

    test('returns null when not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.findById(999, 10, 'user');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('delegates to repository and returns new item bank', async () => {
      const bank = makeItemBank();
      mockCreate.mockResolvedValue(bank);

      const result = await service.create({ name: 'Test Bank' }, 10);

      expect(result).toEqual(bank);
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Test Bank' }, 10);
    });
  });

  describe('update', () => {
    test('delegates to repository and returns updated item bank', async () => {
      const updated = makeItemBank({ name: 'Updated' });
      mockUpdate.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Updated' }, 10, 'admin');

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Updated' }, 10, 'admin');
    });

    test('propagates errors from the repository', async () => {
      mockUpdate.mockRejectedValue(new Error('Item bank not found or access denied'));

      await expect(
        service.update(999, { name: 'X' }, 10, 'user')
      ).rejects.toThrow('Item bank not found or access denied');
    });
  });

  describe('softDelete', () => {
    test('delegates to repository', async () => {
      mockSoftDelete.mockResolvedValue(undefined);

      await service.softDelete(1, 10, 'admin');

      expect(mockSoftDelete).toHaveBeenCalledWith(1, 10, 'admin');
    });

    test('propagates errors from the repository', async () => {
      mockSoftDelete.mockRejectedValue(new Error('Item bank not found or access denied'));

      await expect(service.softDelete(999, 10, 'user')).rejects.toThrow(
        'Item bank not found or access denied'
      );
    });
  });

  describe('PermissionError', () => {
    test('sets name to PermissionError and preserves message', () => {
      const err = new PermissionError('not allowed');

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('PermissionError');
      expect(err.message).toBe('not allowed');
    });
  });
});
