import { beforeEach, describe, expect, test, vi } from 'vitest';

import { TagsService } from '../../controllers/tagsController/service';

const { mockFindAll, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../controllers/tagsController/repository', () => ({
  TagsRepository: function () {
    return {
      findAll: mockFindAll,
      create: mockCreate,
      delete: mockDelete,
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

function makeTag(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Math',
    slug: 'math',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('TagsService', () => {
  let service: TagsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TagsService();
  });

  // --- findAll ---

  describe('findAll', () => {
    test('delegates to repository and returns paginated result', async () => {
      const expected = { items: [makeTag()], total: 1, page: 1, limit: 20 };
      mockFindAll.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(expected);
      expect(mockFindAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  // --- create ---

  describe('create', () => {
    test('normalizes slug to lowercase before creating', async () => {
      const tag = makeTag({ slug: 'uppercase' });
      mockCreate.mockResolvedValue(tag);

      await service.create({ name: 'Uppercase', slug: 'UPPERCASE' });

      expect(mockCreate).toHaveBeenCalledWith({ name: 'Uppercase', slug: 'uppercase' });
    });

    test('replaces non-alphanumeric characters with hyphens', async () => {
      const tag = makeTag({ slug: 'hello-world' });
      mockCreate.mockResolvedValue(tag);

      await service.create({ name: 'Hello World!', slug: 'Hello World!' });

      expect(mockCreate).toHaveBeenCalledWith({ name: 'Hello World!', slug: 'hello-world' });
    });

    test('strips leading and trailing hyphens from the slug', async () => {
      const tag = makeTag({ slug: 'hello' });
      mockCreate.mockResolvedValue(tag);

      await service.create({ name: '--hello--', slug: '--hello--' });

      expect(mockCreate).toHaveBeenCalledWith({ name: '--hello--', slug: 'hello' });
    });

    test('returns the created tag', async () => {
      const tag = makeTag({ name: 'Science', slug: 'science' });
      mockCreate.mockResolvedValue(tag);

      const result = await service.create({ name: 'Science', slug: 'science' });

      expect(result).toEqual(tag);
    });
  });

  // --- delete ---

  describe('delete', () => {
    test('delegates to repository', async () => {
      mockDelete.mockResolvedValue(undefined);

      await service.delete(1);

      expect(mockDelete).toHaveBeenCalledWith(1);
    });

    test('propagates repository errors', async () => {
      mockDelete.mockRejectedValue(new Error('Tag not found'));

      await expect(service.delete(999)).rejects.toThrow('Tag not found');
    });
  });
});
