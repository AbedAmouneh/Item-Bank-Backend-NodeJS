import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateCategorySchema } from '../models';
import { CategoriesService, NotFoundError } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function updateCategory(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.user.roles.includes('org_admin')) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid category ID' },
      });
    }

    const body = UpdateCategorySchema.parse(request.body);
    const category = await service.update(id, body.name);

    return reply.status(200).send({ success: true, data: category });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
    }

    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }

    logger.error({ error }, 'PUT /categories/:id failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
