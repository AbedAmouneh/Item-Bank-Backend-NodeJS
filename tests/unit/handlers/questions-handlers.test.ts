import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteQuestion } from '../../../controllers/questionsController/handlers/delete_question';
import { getQuestions } from '../../../controllers/questionsController/handlers/get_questions';
import { createQuestion } from '../../../controllers/questionsController/handlers/post_question';
import { publishQuestion } from '../../../controllers/questionsController/handlers/post_publish';
import { submitForReview } from '../../../controllers/questionsController/handlers/post_submit_for_review';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

const { mockQuestionsService } = vi.hoisted(() => ({
  mockQuestionsService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    submitForReview: vi.fn(),
    publish: vi.fn(),
    reject: vi.fn(),
  },
}));

vi.mock('../../../controllers/questionsController/service', () => ({
  QuestionsService: function () {
    return mockQuestionsService;
  },
  PermissionError: class PermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PermissionError';
    }
  },
}));

vi.mock('../../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeAuthRequest(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    user: {
      id: 1,
      email: 'user@test.local',
      role: 'user',
      is_active: true,
    },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as any;
}

function makeReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_bank_id: null,
    owner_id: 1,
    type: 'essay',
    name: 'Test Question',
    text: null,
    mark: 1,
    status: 'draft',
    content: {},
    rejection_note: null,
    created_at: new Date(),
    updated_at: new Date(),
    tags: [],
    ...overrides,
  };
}

describe('Questions Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- getQuestions ---

  describe('getQuestions', () => {
    test('returns 200 with paginated question list', async () => {
      const items = [makeQuestion()];
      mockQuestionsService.findAll.mockResolvedValue({
        items,
        total: 1,
        page: 1,
        limit: 20,
      });

      const request = makeAuthRequest({ query: {} });
      const reply = makeReply();

      await getQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { items, total: 1, page: 1, limit: 20 },
      });
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.findAll.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest({ query: {} });
      const reply = makeReply();

      await getQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });
  });

  // --- createQuestion ---

  describe('createQuestion', () => {
    test('returns 201 with created question', async () => {
      const question = makeQuestion();
      mockQuestionsService.create.mockResolvedValue(question);

      const request = makeAuthRequest({
        body: { name: 'Test', type: 'essay', mark: 1 },
      });
      const reply = makeReply();

      await createQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: question,
      });
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.create.mockRejectedValue(
        new Error('Item bank not found')
      );

      const request = makeAuthRequest({
        body: { name: 'Test', type: 'essay', mark: 1 },
      });
      const reply = makeReply();

      await createQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Item bank not found' }),
        })
      );
    });
  });

  // --- deleteQuestion ---

  describe('deleteQuestion', () => {
    test('returns 204 on successful delete', async () => {
      mockQuestionsService.delete.mockResolvedValue(undefined);

      const request = makeAuthRequest({ params: { id: '1' } });
      const reply = makeReply();

      await deleteQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(204);
      expect(reply.send).toHaveBeenCalledWith();
    });

    test('returns 400 for non-numeric id', async () => {
      const request = makeAuthRequest({ params: { id: 'abc' } });
      const reply = makeReply();

      await deleteQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INVALID_ID' }),
        })
      );
      expect(mockQuestionsService.delete).not.toHaveBeenCalled();
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.delete.mockRejectedValue(
        new Error('Question not found or access denied')
      );

      const request = makeAuthRequest({ params: { id: '99' } });
      const reply = makeReply();

      await deleteQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // --- publishQuestion ---

  describe('publishQuestion', () => {
    test('returns 403 when user is not admin', async () => {
      const request = makeAuthRequest({
        user: { id: 1, email: 'user@test.local', role: 'user', is_active: true },
        params: { id: '1' },
      });
      const reply = makeReply();

      await publishQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        })
      );
      expect(mockQuestionsService.publish).not.toHaveBeenCalled();
    });

    test('returns 200 with published question when called by admin', async () => {
      const question = makeQuestion({ status: 'published' });
      mockQuestionsService.publish.mockResolvedValue(question);

      const request = makeAuthRequest({
        user: { id: 99, email: 'admin@test.local', role: 'admin', is_active: true },
        params: { id: '1' },
      });
      const reply = makeReply();

      await publishQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: question,
      });
    });
  });

  // --- submitForReview (status change) ---

  describe('submitForReview', () => {
    test('returns 400 for non-numeric id', async () => {
      const request = makeAuthRequest({ params: { id: 'abc' } });
      const reply = makeReply();

      await submitForReview(request, reply);

      expect(mockQuestionsService.submitForReview).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INVALID_ID' }),
        })
      );
    });

    test('returns 200 with updated question when submission succeeds', async () => {
      const question = makeQuestion({ status: 'in_review' });
      mockQuestionsService.submitForReview.mockResolvedValue(question);

      const request = makeAuthRequest({ params: { id: '1' } });
      const reply = makeReply();

      await submitForReview(request, reply);

      expect(mockQuestionsService.submitForReview).toHaveBeenCalledWith(1, 1);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: question });
    });

    test('returns 500 when service throws (e.g. question not in draft state)', async () => {
      mockQuestionsService.submitForReview.mockRejectedValue(
        new Error('Only draft questions can be submitted for review')
      );

      const request = makeAuthRequest({ params: { id: '1' } });
      const reply = makeReply();

      await submitForReview(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Only draft questions can be submitted for review',
          }),
        })
      );
    });
  });
});
