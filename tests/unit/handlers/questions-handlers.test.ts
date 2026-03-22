import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteQuestion } from '../../../controllers/questionsController/handlers/delete_question';
import { exportQuestions } from '../../../controllers/questionsController/handlers/get_export';
import { getQuestion } from '../../../controllers/questionsController/handlers/get_question';
import { getQuestions } from '../../../controllers/questionsController/handlers/get_questions';
import { reorderQuestions } from '../../../controllers/questionsController/handlers/patch_reorder';
import { rejectQuestion } from '../../../controllers/questionsController/handlers/post_reject';
import { createQuestion } from '../../../controllers/questionsController/handlers/post_question';
import { publishQuestion } from '../../../controllers/questionsController/handlers/post_publish';
import { submitForReview } from '../../../controllers/questionsController/handlers/post_submit_for_review';
import { updateQuestion } from '../../../controllers/questionsController/handlers/put_question';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

// MockPermissionError lives in vi.hoisted() so the same class reference is used
// in both the vi.mock factory (which the handler imports) and the test throw sites.
const {
  mockQuestionsService,
  MockPermissionError,
  mockExportToExcel,
  mockExportToPDF,
} = vi.hoisted(() => {
  class MockPermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PermissionError';
    }
  }
  return {
    mockQuestionsService: {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      submitForReview: vi.fn(),
      publish: vi.fn(),
      reject: vi.fn(),
      reorder: vi.fn(),
    },
    MockPermissionError,
    mockExportToExcel: vi.fn(),
    mockExportToPDF: vi.fn(),
  };
});

vi.mock('../../../controllers/questionsController/service', () => ({
  QuestionsService: function () {
    return mockQuestionsService;
  },
  PermissionError: MockPermissionError,
}));

vi.mock('../../../utils/export/excel', () => ({
  exportToExcel: mockExportToExcel,
}));

vi.mock('../../../utils/export/pdf', () => ({
  exportToPDF: mockExportToPDF,
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
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
    header: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.header as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
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

  // ── getQuestions ─────────────────────────────────────────────────────────

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

  // ── getQuestion ──────────────────────────────────────────────────────────

  describe('getQuestion', () => {
    test('returns 400 for non-numeric id', async () => {
      const request = makeAuthRequest({ params: { id: 'abc' } });
      const reply = makeReply();

      await getQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_ID' }),
        })
      );
      expect(mockQuestionsService.findById).not.toHaveBeenCalled();
    });

    test('returns 404 when service returns null', async () => {
      mockQuestionsService.findById.mockResolvedValue(null);

      const request = makeAuthRequest({ params: { id: '7' } });
      const reply = makeReply();

      await getQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        })
      );
    });

    test('returns 200 with the question', async () => {
      const question = makeQuestion({ id: 7 });
      mockQuestionsService.findById.mockResolvedValue(question);

      const request = makeAuthRequest({ params: { id: '7' } });
      const reply = makeReply();

      await getQuestion(request, reply);

      expect(mockQuestionsService.findById).toHaveBeenCalledWith(7, 1, 'user');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: question });
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.findById.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest({ params: { id: '7' } });
      const reply = makeReply();

      await getQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── exportQuestions ──────────────────────────────────────────────────────

  describe('exportQuestions', () => {
    test('returns 400 when format is missing', async () => {
      const request = makeAuthRequest({ query: {} });
      const reply = makeReply();

      await exportQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(mockQuestionsService.findAll).not.toHaveBeenCalled();
    });

    test('returns xlsx buffer with correct headers', async () => {
      const questions = [makeQuestion()];
      mockQuestionsService.findAll.mockResolvedValue({ items: questions, total: 1 });
      const xlsxBuffer = Buffer.from('xlsx-data');
      mockExportToExcel.mockResolvedValue(xlsxBuffer);

      const request = makeAuthRequest({ query: { format: 'xlsx' } });
      const reply = makeReply();

      await exportQuestions(request, reply);

      expect(mockExportToExcel).toHaveBeenCalled();
      expect(reply.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(reply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="questions.xlsx"'
      );
      expect(reply.send).toHaveBeenCalledWith(xlsxBuffer);
    });

    test('returns pdf buffer with correct headers', async () => {
      const questions = [makeQuestion()];
      mockQuestionsService.findAll.mockResolvedValue({ items: questions, total: 1 });
      const pdfBuffer = Buffer.from('pdf-data');
      mockExportToPDF.mockResolvedValue(pdfBuffer);

      const request = makeAuthRequest({ query: { format: 'pdf' } });
      const reply = makeReply();

      await exportQuestions(request, reply);

      expect(mockExportToPDF).toHaveBeenCalled();
      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(reply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="questions.pdf"'
      );
      expect(reply.send).toHaveBeenCalledWith(pdfBuffer);
    });

    test('returns 500 when service throws', async () => {
      mockQuestionsService.findAll.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest({ query: { format: 'xlsx' } });
      const reply = makeReply();

      await exportQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── reorderQuestions ─────────────────────────────────────────────────────

  describe('reorderQuestions', () => {
    test('returns 400 when question_ids is not an array', async () => {
      const request = makeAuthRequest({ body: { question_ids: 'not-an-array' } });
      const reply = makeReply();

      await reorderQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(mockQuestionsService.reorder).not.toHaveBeenCalled();
    });

    test('returns 400 when question_ids is empty', async () => {
      const request = makeAuthRequest({ body: { question_ids: [] } });
      const reply = makeReply();

      await reorderQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(mockQuestionsService.reorder).not.toHaveBeenCalled();
    });

    test('returns 204 on success', async () => {
      mockQuestionsService.reorder.mockResolvedValue(undefined);

      const request = makeAuthRequest({ body: { question_ids: [3, 1, 2] } });
      const reply = makeReply();

      await reorderQuestions(request, reply);

      expect(mockQuestionsService.reorder).toHaveBeenCalledWith([3, 1, 2], 1, 'user');
      expect(reply.status).toHaveBeenCalledWith(204);
      expect(reply.send).toHaveBeenCalledWith();
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.reorder.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest({ body: { question_ids: [1, 2] } });
      const reply = makeReply();

      await reorderQuestions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── rejectQuestion ───────────────────────────────────────────────────────

  describe('rejectQuestion', () => {
    const adminRequest = (params: object, body: object) =>
      makeAuthRequest({
        user: { id: 99, email: 'admin@test.local', role: 'admin', is_active: true },
        params,
        body,
      });

    test('returns 403 when user is not admin', async () => {
      const request = makeAuthRequest({ params: { id: '1' }, body: { rejection_note: 'Bad' } });
      const reply = makeReply();

      await rejectQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(mockQuestionsService.reject).not.toHaveBeenCalled();
    });

    test('returns 400 for non-numeric id', async () => {
      const request = adminRequest({ id: 'abc' }, { rejection_note: 'Bad' });
      const reply = makeReply();

      await rejectQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(mockQuestionsService.reject).not.toHaveBeenCalled();
    });

    test('returns 200 with rejected question', async () => {
      const question = makeQuestion({ status: 'rejected', rejection_note: 'Unclear' });
      mockQuestionsService.reject.mockResolvedValue(question);

      const request = adminRequest({ id: '5' }, { rejection_note: 'Unclear' });
      const reply = makeReply();

      await rejectQuestion(request, reply);

      expect(mockQuestionsService.reject).toHaveBeenCalledWith(5, 'Unclear', 'admin');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: question });
    });

    test('returns 500 on service error', async () => {
      mockQuestionsService.reject.mockRejectedValue(new Error('Invalid state'));

      const request = adminRequest({ id: '5' }, { rejection_note: 'Bad' });
      const reply = makeReply();

      await rejectQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── updateQuestion ───────────────────────────────────────────────────────

  describe('updateQuestion', () => {
    test('returns 400 for non-numeric id', async () => {
      const request = makeAuthRequest({ params: { id: 'xyz' }, body: { name: 'New Name' } });
      const reply = makeReply();

      await updateQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(mockQuestionsService.update).not.toHaveBeenCalled();
    });

    test('returns 403 when service throws PermissionError', async () => {
      mockQuestionsService.update.mockRejectedValue(
        new MockPermissionError('You do not own this question')
      );

      const request = makeAuthRequest({ params: { id: '1' }, body: { name: 'New' } });
      const reply = makeReply();

      await updateQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        })
      );
    });

    test('returns 200 with updated question', async () => {
      const question = makeQuestion({ name: 'Updated Name' });
      mockQuestionsService.update.mockResolvedValue(question);

      const request = makeAuthRequest({
        params: { id: '1' },
        body: { name: 'Updated Name' },
      });
      const reply = makeReply();

      await updateQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: question });
    });

    test('returns 500 on generic service error', async () => {
      mockQuestionsService.update.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest({ params: { id: '1' }, body: { name: 'X' } });
      const reply = makeReply();

      await updateQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── createQuestion ───────────────────────────────────────────────────────

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

    test('returns 400 with validation message when body fails Zod schema', async () => {
      // Sending a body that fails CreateQuestionSchema (missing required 'type')
      const request = makeAuthRequest({
        body: { name: 'Test', mark: 1 },
      });
      const reply = makeReply();

      await createQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
      expect(mockQuestionsService.create).not.toHaveBeenCalled();
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

  // ── deleteQuestion ───────────────────────────────────────────────────────

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

  // ── publishQuestion ──────────────────────────────────────────────────────

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

    test('returns 400 for non-numeric id', async () => {
      const request = makeAuthRequest({
        user: { id: 99, email: 'admin@test.local', role: 'admin', is_active: true },
        params: { id: 'abc' },
      });
      const reply = makeReply();

      await publishQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INVALID_ID' }),
        })
      );
      expect(mockQuestionsService.publish).not.toHaveBeenCalled();
    });

    test('returns 500 when service throws', async () => {
      mockQuestionsService.publish.mockRejectedValue(new Error('Question not in review'));

      const request = makeAuthRequest({
        user: { id: 99, email: 'admin@test.local', role: 'admin', is_active: true },
        params: { id: '5' },
      });
      const reply = makeReply();

      await publishQuestion(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Question not in review' }),
        })
      );
    });
  });

  // ── submitForReview ──────────────────────────────────────────────────────

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
