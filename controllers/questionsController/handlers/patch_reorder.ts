import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

interface ReorderRequest {
  question_ids: number[];
}

export async function reorderQuestions(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = request.body as ReorderRequest;

    if (!Array.isArray(body.question_ids) || body.question_ids.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'question_ids must be a non-empty array' },
      });
    }

    await service.reorder(body.question_ids, request.user.id, request.user.role);

    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'PATCH /questions/reorder failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
