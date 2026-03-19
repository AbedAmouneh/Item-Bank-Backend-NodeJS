import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

export async function publishQuestion(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid question ID' },
      });
    }

    const question = await service.publish(id, request.user.role);

    return reply.status(200).send({ success: true, data: question });
  } catch (error) {
    logger.error({ error }, 'POST /questions/:id/publish failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
