import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CategoriesService, ConflictError, NotFoundError } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function deleteCategory(
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

    await service.delete(id);
    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'DELETE /categories/:id failed');

    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }

    if (error instanceof ConflictError) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: error.message },
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
