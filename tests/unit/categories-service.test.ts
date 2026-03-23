import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CategoriesService, ConflictError, ForbiddenError } from '../../controllers/categoriesController/service';

const {
  mockFindAll,
  mockCreate,
  mockUpdate,
  mockCountChildren,
  mockCountAssignedQuestions,
  mockDelete,
  mockAssignQuestions,
  mockRemoveQuestion,
  mockCountOwnedQuestions,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockCountChildren: vi.fn(),
  mockCountAssignedQuestions: vi.fn(),
  mockDelete: vi.fn(),
  mockAssignQuestions: vi.fn(),
  mockRemoveQuestion: vi.fn(),
  mockCountOwnedQuestions: vi.fn(),
}));

vi.mock('../../controllers/categoriesController/repository', () => ({
  CategoriesRepository: function () {
    return {
      findAll: mockFindAll,
      create: mockCreate,
      update: mockUpdate,
      countChildren: mockCountChildren,
      countAssignedQuestions: mockCountAssignedQuestions,
      delete: mockDelete,
      assignQuestions: mockAssignQuestions,
      removeQuestion: mockRemoveQuestion,
      countOwnedQuestions: mockCountOwnedQuestions,
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

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoriesService();
  });

  describe('getTree', () => {
    test('returns empty array when no categories exist', async () => {
      mockFindAll.mockResolvedValue([]);

      const result = await service.getTree();

      expect(result).toEqual([]);
    });

    test('returns flat root nodes as top-level children', async () => {
      mockFindAll.mockResolvedValue([
        { id: 1, name: 'Science', parent_id: null, path: [1] },
        { id: 2, name: 'History', parent_id: null, path: [2] },
      ]);

      const result = await service.getTree();

      expect(result).toEqual([
        { id: 1, name: 'Science', children: [] },
        { id: 2, name: 'History', children: [] },
      ]);
    });

    test('nests children under their parent', async () => {
      mockFindAll.mockResolvedValue([
        { id: 1, name: 'Science', parent_id: null, path: [1] },
        { id: 2, name: 'Physics', parent_id: 1, path: [1, 2] },
        { id: 3, name: 'Biology', parent_id: 1, path: [1, 3] },
        { id: 4, name: 'Quantum', parent_id: 2, path: [1, 2, 4] },
      ]);

      const result = await service.getTree();

      expect(result).toEqual([
        {
          id: 1,
          name: 'Science',
          children: [
            {
              id: 2,
              name: 'Physics',
              children: [{ id: 4, name: 'Quantum', children: [] }],
            },
            { id: 3, name: 'Biology', children: [] },
          ],
        },
      ]);
    });
  });

  describe('create', () => {
    test('returns Category with empty children', async () => {
      mockCreate.mockResolvedValue({ id: 5, name: 'Art', parent_id: null, path: [5] });

      const result = await service.create({ name: 'Art' }, 7);

      expect(result).toEqual({ id: 5, name: 'Art', children: [] });
    });
  });

  describe('update', () => {
    test('returns updated Category with empty children', async () => {
      mockUpdate.mockResolvedValue({ id: 1, name: 'Renamed', parent_id: null, path: [1] });

      const result = await service.update(1, 'Renamed');

      expect(result).toEqual({ id: 1, name: 'Renamed', children: [] });
    });
  });

  describe('delete', () => {
    test('throws ConflictError when category has children', async () => {
      mockCountChildren.mockResolvedValue(2);
      mockCountAssignedQuestions.mockResolvedValue(0);

      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    test('throws ConflictError when category has assigned questions', async () => {
      mockCountChildren.mockResolvedValue(0);
      mockCountAssignedQuestions.mockResolvedValue(3);

      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    test('deletes when no children and no questions', async () => {
      mockCountChildren.mockResolvedValue(0);
      mockCountAssignedQuestions.mockResolvedValue(0);
      mockDelete.mockResolvedValue(undefined);

      await expect(service.delete(1)).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith(1);
    });
  });

  describe('assignQuestions', () => {
    test('proceeds without ownership check for admin', async () => {
      mockAssignQuestions.mockResolvedValue(undefined);

      await service.assignQuestions(1, [10, 20], 7, 'admin');

      expect(mockCountOwnedQuestions).not.toHaveBeenCalled();
      expect(mockAssignQuestions).toHaveBeenCalledWith(1, [10, 20]);
    });

    test('throws ForbiddenError when non-admin tries to assign others questions', async () => {
      mockCountOwnedQuestions.mockResolvedValue(1); // only 1 of 2 owned

      await expect(service.assignQuestions(1, [10, 20], 7, 'user')).rejects.toThrow(ForbiddenError);
    });

    test('proceeds when non-admin owns all question_ids', async () => {
      mockCountOwnedQuestions.mockResolvedValue(2);
      mockAssignQuestions.mockResolvedValue(undefined);

      await service.assignQuestions(1, [10, 20], 7, 'user');

      expect(mockAssignQuestions).toHaveBeenCalledWith(1, [10, 20]);
    });
  });

  describe('removeQuestion', () => {
    test('proceeds without ownership check for admin', async () => {
      mockRemoveQuestion.mockResolvedValue(undefined);

      await service.removeQuestion(1, 10, 7, 'admin');

      expect(mockCountOwnedQuestions).not.toHaveBeenCalled();
    });

    test('throws ForbiddenError when non-admin tries to remove others question', async () => {
      mockCountOwnedQuestions.mockResolvedValue(0);

      await expect(service.removeQuestion(1, 10, 7, 'user')).rejects.toThrow(ForbiddenError);
    });

    test('proceeds when non-admin owns the question', async () => {
      mockCountOwnedQuestions.mockResolvedValue(1);
      mockRemoveQuestion.mockResolvedValue(undefined);

      await service.removeQuestion(1, 10, 7, 'user');

      expect(mockRemoveQuestion).toHaveBeenCalledWith(1, 10);
    });
  });
});
