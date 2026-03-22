import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();
const clientQueryMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
    transaction: transactionMock,
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
    type: 'essay',
    name: 'Test Question',
    text: null,
    mark: 1,
    status: 'draft',
    content: {},
    rejection_note: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('QuestionsRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    clientQueryMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(
      async (cb: (client: { query: typeof clientQueryMock }) => Promise<unknown>) =>
        cb({ query: clientQueryMock })
    );
  });

  // --- findAll ---

  describe('findAll', () => {
    test('fetches all questions for admin without owner filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [makeQuestion({ id: 1 }), makeQuestion({ id: 2 })] })
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.findAll({ page: 1, limit: 20 }, 10, 'admin');

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).not.toContain('owner_id');
      expect(countCall?.[1]).toEqual([]);
    });

    test('filters by owner_id for regular user', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeQuestion()] })
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.findAll({ page: 1, limit: 20 }, 10, 'user');

      const [countCall, dataCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('owner_id = $1');
      expect(countCall?.[1]).toEqual([10]);
      // params = [owner_id=10], then userId=10 appended for the question_order JOIN, then limit/offset
      expect(dataCall?.[1]).toEqual([10, 10, 20, 0]);
    });
  });

  // --- create ---

  describe('create', () => {
    test('inserts question and returns it with empty tags', async () => {
      const mockQuestion = makeQuestion();
      clientQueryMock
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.create(
        { name: 'Test', type: 'essay', mark: 1, content: {}, tag_ids: [] },
        10
      );

      expect(result.id).toBe(1);
      expect(result.tags).toEqual([]);
      expect(transactionMock).toHaveBeenCalledTimes(1);

      const [insertCall] = clientQueryMock.mock.calls;
      expect(insertCall?.[0]).toContain('INSERT INTO questions');
      expect(insertCall?.[1]).toContain(10);
    });

    test('inserts into question_tags when tag_ids are provided', async () => {
      const mockQuestion = makeQuestion();
      clientQueryMock
        .mockResolvedValueOnce({ rows: [mockQuestion] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.create(
        { name: 'Test', type: 'essay', mark: 1, content: {}, tag_ids: [1, 2] },
        10
      );

      expect(clientQueryMock).toHaveBeenCalledTimes(3);
      const tagInsertCall = clientQueryMock.mock.calls[1];
      expect(tagInsertCall?.[0]).toContain('INSERT INTO question_tags');
      expect(tagInsertCall?.[1]).toContain(1);
      expect(tagInsertCall?.[1]).toContain(2);
    });
  });

  // --- delete ---

  describe('delete', () => {
    test('verifies ownership then deletes the question', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [makeQuestion()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.delete(1, 10, 'user');

      expect(queryMock).toHaveBeenCalledTimes(3);
      const deleteCall = queryMock.mock.calls[2];
      expect(deleteCall?.[0]).toContain('DELETE FROM questions');
      expect(deleteCall?.[1]).toContain(1);
    });

    test('throws when question is not found or not owned by user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.delete(999, 10, 'user')).rejects.toThrow(
        'Question not found or access denied'
      );
    });
  });

  // --- submitForReview ---

  describe('submitForReview', () => {
    test('transitions question from draft to in_review', async () => {
      const draftQuestion = makeQuestion({ status: 'draft' });
      const inReviewQuestion = makeQuestion({ status: 'in_review' });

      queryMock
        .mockResolvedValueOnce({ rows: [draftQuestion] })
        .mockResolvedValueOnce({ rows: [inReviewQuestion] })
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.submitForReview(1, 10);

      expect(result.status).toBe('in_review');

      const updateCall = queryMock.mock.calls[1];
      expect(updateCall?.[0]).toContain("status = 'in_review'");
      expect(updateCall?.[1]).toContain(1);
    });

    test('throws when question is not in draft status', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [makeQuestion({ status: 'in_review' })],
      });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.submitForReview(1, 10)).rejects.toThrow(
        'Only draft questions can be submitted for review'
      );
    });

    test('throws when question is not owned by user', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.submitForReview(1, 99)).rejects.toThrow(
        'Question not found or access denied'
      );
    });
  });

  // --- findById ---

  describe('findById', () => {
    test('uses single param query for admin (no owner filter)', async () => {
      const question = makeQuestion();
      queryMock
        .mockResolvedValueOnce({ rows: [question] }) // SELECT question
        .mockResolvedValueOnce({ rows: [] });         // fetchTagsForQuestions

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.findById(1, 10, 'admin');

      expect(result).not.toBeNull();
      const [selectCall] = queryMock.mock.calls;
      expect(selectCall?.[1]).toEqual([1]); // only id, no owner_id
      expect(selectCall?.[0]).not.toContain('owner_id');
    });

    test('includes owner_id param for regular user', async () => {
      const question = makeQuestion();
      queryMock
        .mockResolvedValueOnce({ rows: [question] })
        .mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.findById(1, 10, 'user');

      const [selectCall] = queryMock.mock.calls;
      expect(selectCall?.[1]).toEqual([1, 10]);
      expect(selectCall?.[0]).toContain('owner_id = $2');
    });

    test('returns null when not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.findById(999, 10, 'user');

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1); // no tags query when not found
    });

    test('attaches tags to the returned question', async () => {
      const question = makeQuestion();
      queryMock
        .mockResolvedValueOnce({ rows: [question] })
        .mockResolvedValueOnce({
          rows: [{ question_id: 1, id: 7, name: 'Algebra', slug: 'algebra' }],
        });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.findById(1, 10, 'admin');

      expect(result?.tags).toEqual([{ id: 7, name: 'Algebra', slug: 'algebra' }]);
    });
  });

  // --- update ---

  describe('update', () => {
    test('updates fields and re-fetches the question', async () => {
      const existing = makeQuestion();
      const updated = makeQuestion({ name: 'Updated Name' });
      queryMock
        .mockResolvedValueOnce({ rows: [existing] }) // findById: SELECT question
        .mockResolvedValueOnce({ rows: [] })          // findById: tags
        .mockResolvedValueOnce({ rowCount: 1 })       // UPDATE
        .mockResolvedValueOnce({ rows: [updated] })   // re-fetch SELECT
        .mockResolvedValueOnce({ rows: [] });          // re-fetch tags

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.update(1, { name: 'Updated Name' }, 10, 'user');

      expect(result.name).toBe('Updated Name');
      const updateCall = queryMock.mock.calls[2];
      expect(updateCall?.[0]).toContain('UPDATE questions SET');
      expect(updateCall?.[0]).toContain('name = $2');
    });

    test('replaces tags inside a transaction when tag_ids are provided', async () => {
      const existing = makeQuestion();
      const updated = makeQuestion();
      queryMock
        .mockResolvedValueOnce({ rows: [existing] }) // findById: SELECT
        .mockResolvedValueOnce({ rows: [] })          // findById: tags
        .mockResolvedValueOnce({ rows: [updated] })   // re-fetch SELECT
        .mockResolvedValueOnce({ rows: [] });          // re-fetch tags

      clientQueryMock
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE FROM question_tags
        .mockResolvedValueOnce({ rowCount: 2 }); // INSERT INTO question_tags

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.update(1, { tag_ids: [3, 4] }, 10, 'user');

      expect(transactionMock).toHaveBeenCalledTimes(1);
      const deleteCall = clientQueryMock.mock.calls[0];
      expect(deleteCall?.[0]).toContain('DELETE FROM question_tags');
      const insertCall = clientQueryMock.mock.calls[1];
      expect(insertCall?.[0]).toContain('INSERT INTO question_tags');
    });

    test('throws when question is not found or not owned', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(
        repo.update(999, { name: 'X' }, 10, 'user')
      ).rejects.toThrow('Question not found or access denied');
    });
  });

  // --- publish ---

  describe('publish', () => {
    test('transitions question from in_review to published', async () => {
      const inReview = makeQuestion({ status: 'in_review' });
      const published = makeQuestion({ status: 'published' });
      queryMock
        .mockResolvedValueOnce({ rows: [inReview] })   // SELECT
        .mockResolvedValueOnce({ rows: [published] })  // UPDATE RETURNING
        .mockResolvedValueOnce({ rows: [] });           // tags

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.publish(1);

      expect(result.status).toBe('published');
      const updateCall = queryMock.mock.calls[1];
      expect(updateCall?.[0]).toContain("status = 'published'");
    });

    test('throws when question is not in_review', async () => {
      queryMock.mockResolvedValueOnce({ rows: [makeQuestion({ status: 'draft' })] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.publish(1)).rejects.toThrow(
        'Only questions in review can be published'
      );
    });

    test('throws when question is not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.publish(999)).rejects.toThrow('Question not found');
    });
  });

  // --- reject ---

  describe('reject', () => {
    test('transitions question from in_review back to draft with a note', async () => {
      const inReview = makeQuestion({ status: 'in_review' });
      const rejected = makeQuestion({ status: 'draft', rejection_note: 'Needs work' });
      queryMock
        .mockResolvedValueOnce({ rows: [inReview] })   // SELECT
        .mockResolvedValueOnce({ rows: [rejected] })   // UPDATE RETURNING
        .mockResolvedValueOnce({ rows: [] });           // tags

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      const result = await repo.reject(1, 'Needs work');

      expect(result.status).toBe('draft');
      const updateCall = queryMock.mock.calls[1];
      expect(updateCall?.[0]).toContain("status = 'draft'");
      expect(updateCall?.[0]).toContain('rejection_note = $2');
      expect(updateCall?.[1]).toContain('Needs work');
    });

    test('throws when question is not in_review', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [makeQuestion({ status: 'published' })],
      });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.reject(1, 'note')).rejects.toThrow(
        'Only questions in review can be rejected'
      );
    });

    test('throws when question is not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.reject(999, 'note')).rejects.toThrow('Question not found');
    });
  });

  // --- checkItemBankAccess ---

  describe('checkItemBankAccess', () => {
    test('does not throw when user owns the item bank', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ owner_id: 10 }] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.checkItemBankAccess(5, 10, 'user')).resolves.toBeUndefined();
    });

    test('does not throw for admin even when they do not own the bank', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ owner_id: 99 }] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.checkItemBankAccess(5, 10, 'admin')).resolves.toBeUndefined();
    });

    test('throws when user does not own the item bank', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ owner_id: 99 }] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.checkItemBankAccess(5, 10, 'user')).rejects.toThrow(
        'You do not have access to this item bank'
      );
    });

    test('throws when item bank does not exist', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.checkItemBankAccess(999, 10, 'user')).rejects.toThrow(
        'Item bank not found'
      );
    });
  });

  // --- reorder ---

  describe('reorder', () => {
    test('throws immediately when question IDs array is empty', async () => {
      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.reorder([], 10, 'user')).rejects.toThrow(
        'Invalid question IDs array'
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    test('verifies ownership, deletes old order, and inserts new order for user', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // COUNT of unauthorized
        .mockResolvedValueOnce({ rowCount: 3 })             // DELETE existing order
        .mockResolvedValueOnce({ rowCount: 3 });            // INSERT new order

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.reorder([1, 2, 3], 10, 'user');

      expect(queryMock).toHaveBeenCalledTimes(3);
      const ownershipCheck = queryMock.mock.calls[0];
      expect(ownershipCheck?.[0]).toContain('owner_id != $2');
      const deleteCall = queryMock.mock.calls[1];
      expect(deleteCall?.[0]).toContain('DELETE FROM question_order');
      const insertCall = queryMock.mock.calls[2];
      expect(insertCall?.[0]).toContain('INSERT INTO question_order');
    });

    test('skips ownership check for admin', async () => {
      queryMock
        .mockResolvedValueOnce({ rowCount: 2 })  // DELETE
        .mockResolvedValueOnce({ rowCount: 2 }); // INSERT

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();
      await repo.reorder([1, 2], 10, 'admin');

      expect(queryMock).toHaveBeenCalledTimes(2); // no COUNT check
      const firstCall = queryMock.mock.calls[0];
      expect(firstCall?.[0]).toContain('DELETE FROM question_order');
    });

    test('throws when user tries to reorder questions they do not own', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // 1 unauthorized question

      const { QuestionsRepository } = await import(
        '../../controllers/questionsController/repository'
      );
      const repo = new QuestionsRepository();

      await expect(repo.reorder([1, 2], 10, 'user')).rejects.toThrow(
        'You do not have permission to reorder some of these questions'
      );
      expect(queryMock).toHaveBeenCalledTimes(1); // no DELETE or INSERT
    });
  });
});
