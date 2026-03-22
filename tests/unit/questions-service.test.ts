import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  PermissionError,
  QuestionsService,
} from '../../controllers/questionsController/service';

const {
  mockFindAll,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockSubmitForReview,
  mockPublish,
  mockReject,
  mockCheckItemBankAccess,
  mockReorder,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSubmitForReview: vi.fn(),
  mockPublish: vi.fn(),
  mockReject: vi.fn(),
  mockCheckItemBankAccess: vi.fn(),
  mockReorder: vi.fn(),
}));

vi.mock('../../controllers/questionsController/repository', () => ({
  QuestionsRepository: function () {
    return {
      findAll: mockFindAll,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      submitForReview: mockSubmitForReview,
      publish: mockPublish,
      reject: mockReject,
      checkItemBankAccess: mockCheckItemBankAccess,
      reorder: mockReorder,
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

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_bank_id: null,
    owner_id: 10,
    type: 'essay' as const,
    name: 'Test Question',
    text: null,
    mark: 1,
    status: 'draft' as const,
    content: {},
    rejection_note: null,
    created_at: new Date(),
    updated_at: new Date(),
    tags: [],
    ...overrides,
  };
}

describe('QuestionsService', () => {
  let service: QuestionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuestionsService();
  });

  // --- findAll ---

  describe('findAll', () => {
    test('delegates to repository and returns result', async () => {
      const expected = { items: [makeQuestion()], total: 1, page: 1, limit: 20 };
      mockFindAll.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 20 }, 10, 'user');

      expect(result).toEqual(expected);
      expect(mockFindAll).toHaveBeenCalledWith({ page: 1, limit: 20 }, 10, 'user');
    });
  });

  // --- findById ---

  describe('findById', () => {
    test('returns question when found', async () => {
      const question = makeQuestion();
      mockFindById.mockResolvedValue(question);

      const result = await service.findById(1, 10, 'user');

      expect(result).toEqual(question);
      expect(mockFindById).toHaveBeenCalledWith(1, 10, 'user');
    });

    test('returns null when not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.findById(999, 10, 'user');

      expect(result).toBeNull();
    });
  });

  // --- create ---

  describe('create', () => {
    test('creates question when no item bank is provided', async () => {
      const question = makeQuestion();
      mockCreate.mockResolvedValue(question);

      const result = await service.create(
        { name: 'Test', type: 'essay', mark: 1, content: {}, tag_ids: [] },
        10,
        'user'
      );

      expect(result).toEqual(question);
      expect(mockCheckItemBankAccess).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test' }),
        10
      );
    });

    test('verifies item bank access before creating', async () => {
      const question = makeQuestion({ item_bank_id: 5 });
      mockCheckItemBankAccess.mockResolvedValue(undefined);
      mockCreate.mockResolvedValue(question);

      await service.create(
        {
          name: 'Test',
          type: 'essay',
          mark: 1,
          content: {},
          tag_ids: [],
          item_bank_id: 5,
        },
        10,
        'user'
      );

      expect(mockCheckItemBankAccess).toHaveBeenCalledWith(5, 10, 'user');
      expect(mockCreate).toHaveBeenCalled();
    });

    test('throws when item bank does not belong to user', async () => {
      mockCheckItemBankAccess.mockRejectedValue(
        new Error('You do not have access to this item bank')
      );

      await expect(
        service.create(
          {
            name: 'Test',
            type: 'essay',
            mark: 1,
            content: {},
            tag_ids: [],
            item_bank_id: 99,
          },
          10,
          'user'
        )
      ).rejects.toThrow('You do not have access to this item bank');

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // --- update ---

  describe('update', () => {
    test('allows updating a draft question as regular user', async () => {
      const existing = makeQuestion({ status: 'draft' });
      const updated = makeQuestion({ name: 'Updated' });
      mockFindById.mockResolvedValue(existing);
      mockUpdate.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Updated' }, 10, 'user');

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Updated' }, 10, 'user');
    });

    test('throws PermissionError when user tries to update a published question', async () => {
      mockFindById.mockResolvedValue(makeQuestion({ status: 'published' }));

      await expect(
        service.update(1, { name: 'New Name' }, 10, 'user')
      ).rejects.toThrow(PermissionError);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    test('allows admin to update a published question', async () => {
      const existing = makeQuestion({ status: 'published' });
      const updated = makeQuestion({ status: 'published', name: 'Admin Edit' });
      mockFindById.mockResolvedValue(existing);
      mockUpdate.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Admin Edit' }, 99, 'admin');

      expect(result).toEqual(updated);
    });

    test('throws when question is not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'X' }, 10, 'user')
      ).rejects.toThrow('Question not found or access denied');
    });
  });

  // --- submitForReview ---

  describe('submitForReview', () => {
    test('delegates to repository and returns updated question', async () => {
      const question = makeQuestion({ status: 'in_review' as const });
      mockSubmitForReview.mockResolvedValue(question);

      const result = await service.submitForReview(1, 10);

      expect(result).toEqual(question);
      expect(mockSubmitForReview).toHaveBeenCalledWith(1, 10);
    });
  });

  // --- publish ---

  describe('publish', () => {
    test('throws PermissionError when caller is not admin', async () => {
      await expect(service.publish(1, 'user')).rejects.toThrow(PermissionError);
      expect(mockPublish).not.toHaveBeenCalled();
    });

    test('publishes question when called by admin', async () => {
      const question = makeQuestion({ status: 'published' as const });
      mockPublish.mockResolvedValue(question);

      const result = await service.publish(1, 'admin');

      expect(result).toEqual(question);
      expect(mockPublish).toHaveBeenCalledWith(1);
    });
  });

  // --- delete ---

  describe('delete', () => {
    test('delegates to repository', async () => {
      mockDelete.mockResolvedValue(undefined);

      await service.delete(1, 10, 'user');

      expect(mockDelete).toHaveBeenCalledWith(1, 10, 'user');
    });

    test('propagates repository errors', async () => {
      mockDelete.mockRejectedValue(new Error('Question not found or access denied'));

      await expect(service.delete(999, 10, 'user')).rejects.toThrow(
        'Question not found or access denied'
      );
    });
  });

  // --- reorder ---

  describe('reorder', () => {
    test('delegates to repository', async () => {
      mockReorder.mockResolvedValue(undefined);

      await service.reorder([1, 2, 3], 10, 'user');

      expect(mockReorder).toHaveBeenCalledWith([1, 2, 3], 10, 'user');
    });
  });

  // --- reject ---

  describe('reject', () => {
    test('throws PermissionError when caller is not admin', async () => {
      await expect(service.reject(1, 'bad', 'user')).rejects.toThrow(
        PermissionError
      );
      expect(mockReject).not.toHaveBeenCalled();
    });

    test('rejects question when called by admin', async () => {
      const question = makeQuestion({ rejection_note: 'Needs work' });
      mockReject.mockResolvedValue(question);

      const result = await service.reject(1, 'Needs work', 'admin');

      expect(result).toEqual(question);
      expect(mockReject).toHaveBeenCalledWith(1, 'Needs work');
    });
  });
});
