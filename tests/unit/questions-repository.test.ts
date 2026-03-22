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
});
