import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CategoriesService, ForbiddenError } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function removeQuestionFromCategory(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const params = request.params as { id: string; questionId: string };
    const id = parseInt(params.id, 10);
    const questionId = parseInt(params.questionId, 10);

    if (isNaN(id) || isNaN(questionId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid ID' },
      });
    }

    await service.removeQuestion(id, questionId, request.user.id, request.user.roles);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }

    logger.error({ error }, 'DELETE /categories/:id/questions/:questionId failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
