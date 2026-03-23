import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssignQuestionsSchema } from '../models';
import { CategoriesService, ForbiddenError } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function assignQuestionsToCategory(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid category ID' },
      });
    }

    const body = AssignQuestionsSchema.parse(request.body);
    await service.assignQuestions(id, body.question_ids, request.user.id, request.user.role);

    return reply.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
    }

    logger.error({ error }, 'POST /categories/:id/questions failed');

    if (error instanceof ForbiddenError) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
