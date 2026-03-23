import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockRepo = {
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  countChildren: vi.fn(),
  countAssignedQuestions: vi.fn(),
  delete: vi.fn(),
  assignQuestions: vi.fn(),
  removeQuestion: vi.fn(),
  countOwnedQuestions: vi.fn(),
};

vi.mock('../../controllers/categoriesController/repository', () => ({
  CategoriesRepository: vi.fn(() => mockRepo),
}));

describe('CategoriesService', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mockRepo).forEach(fn => fn.mockReset());
  });

  describe('getTree', () => {
    test('returns empty array when no categories exist', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      const result = await service.getTree();

      expect(result).toEqual([]);
    });

    test('returns flat root nodes as top-level children', async () => {
      mockRepo.findAll.mockResolvedValue([
        { id: 1, name: 'Science', parent_id: null, path: [1] },
        { id: 2, name: 'History', parent_id: null, path: [2] },
      ]);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      const result = await service.getTree();

      expect(result).toEqual([
        { id: 1, name: 'Science', children: [] },
        { id: 2, name: 'History', children: [] },
      ]);
    });

    test('nests children under their parent', async () => {
      mockRepo.findAll.mockResolvedValue([
        { id: 1, name: 'Science', parent_id: null, path: [1] },
        { id: 2, name: 'Physics', parent_id: 1, path: [1, 2] },
        { id: 3, name: 'Biology', parent_id: 1, path: [1, 3] },
        { id: 4, name: 'Quantum', parent_id: 2, path: [1, 2, 4] },
      ]);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
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
      mockRepo.create.mockResolvedValue({ id: 5, name: 'Art', parent_id: null, path: [5] });

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      const result = await service.create({ name: 'Art' }, 7);

      expect(result).toEqual({ id: 5, name: 'Art', children: [] });
    });
  });

  describe('update', () => {
    test('returns updated Category with empty children', async () => {
      mockRepo.update.mockResolvedValue({ id: 1, name: 'Renamed', parent_id: null, path: [1] });

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      const result = await service.update(1, 'Renamed');

      expect(result).toEqual({ id: 1, name: 'Renamed', children: [] });
    });
  });

  describe('delete', () => {
    test('throws ConflictError when category has children', async () => {
      mockRepo.countChildren.mockResolvedValue(2);
      mockRepo.countAssignedQuestions.mockResolvedValue(0);

      const { CategoriesService, ConflictError } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    test('throws ConflictError when category has assigned questions', async () => {
      mockRepo.countChildren.mockResolvedValue(0);
      mockRepo.countAssignedQuestions.mockResolvedValue(3);

      const { CategoriesService, ConflictError } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    test('deletes when no children and no questions', async () => {
      mockRepo.countChildren.mockResolvedValue(0);
      mockRepo.countAssignedQuestions.mockResolvedValue(0);
      mockRepo.delete.mockResolvedValue(undefined);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await expect(service.delete(1)).resolves.toBeUndefined();
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('assignQuestions', () => {
    test('proceeds without ownership check for admin', async () => {
      mockRepo.assignQuestions.mockResolvedValue(undefined);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await service.assignQuestions(1, [10, 20], 7, 'admin');

      expect(mockRepo.countOwnedQuestions).not.toHaveBeenCalled();
      expect(mockRepo.assignQuestions).toHaveBeenCalledWith(1, [10, 20]);
    });

    test('throws ForbiddenError when non-admin tries to assign others questions', async () => {
      mockRepo.countOwnedQuestions.mockResolvedValue(1); // only 1 of 2 owned

      const { CategoriesService, ForbiddenError } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await expect(service.assignQuestions(1, [10, 20], 7, 'user')).rejects.toThrow(
        ForbiddenError
      );
    });

    test('proceeds when non-admin owns all question_ids', async () => {
      mockRepo.countOwnedQuestions.mockResolvedValue(2);
      mockRepo.assignQuestions.mockResolvedValue(undefined);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await service.assignQuestions(1, [10, 20], 7, 'user');

      expect(mockRepo.assignQuestions).toHaveBeenCalledWith(1, [10, 20]);
    });
  });

  describe('removeQuestion', () => {
    test('proceeds without ownership check for admin', async () => {
      mockRepo.removeQuestion.mockResolvedValue(undefined);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await service.removeQuestion(1, 10, 7, 'admin');

      expect(mockRepo.countOwnedQuestions).not.toHaveBeenCalled();
    });

    test('throws ForbiddenError when non-admin tries to remove others question', async () => {
      mockRepo.countOwnedQuestions.mockResolvedValue(0);

      const { CategoriesService, ForbiddenError } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await expect(service.removeQuestion(1, 10, 7, 'user')).rejects.toThrow(ForbiddenError);
    });

    test('proceeds when non-admin owns the question', async () => {
      mockRepo.countOwnedQuestions.mockResolvedValue(1);
      mockRepo.removeQuestion.mockResolvedValue(undefined);

      const { CategoriesService } = await import(
        '../../controllers/categoriesController/service'
      );
      const service = new CategoriesService();
      await service.removeQuestion(1, 10, 7, 'user');

      expect(mockRepo.removeQuestion).toHaveBeenCalledWith(1, 10);
    });
  });
});
