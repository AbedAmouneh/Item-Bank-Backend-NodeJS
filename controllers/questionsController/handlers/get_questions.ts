import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { QuestionListQuerySchema } from '../models';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

export async function getQuestions(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = QuestionListQuerySchema.parse(request.query);
    const result = await service.findAll(query, request.user.id, request.user.role);

    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'GET /questions failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
