import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CategoriesService } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function getCategories(
  _request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const tree = await service.getTree();
    return reply.status(200).send({ success: true, data: tree });
  } catch (error) {
    logger.error({ error }, 'GET /categories failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
