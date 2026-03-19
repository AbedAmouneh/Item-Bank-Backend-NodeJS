import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateQuestionSchema } from '../models';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

export async function createQuestion(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = CreateQuestionSchema.parse(request.body);
    const question = await service.create(body, request.user.id, request.user.role);

    return reply.status(201).send({ success: true, data: question });
  } catch (error) {
    logger.error({ error }, 'POST /questions failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
