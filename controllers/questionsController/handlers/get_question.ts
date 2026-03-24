import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

export async function getQuestion(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid question ID' },
      });
    }

    const question = await service.findById(id, request.user.id, request.user.roles, request.user.tenant_id);

    if (!question) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Question not found' },
      });
    }

    return reply.status(200).send({ success: true, data: question });
  } catch (error) {
    logger.error({ error }, 'GET /questions/:id failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
