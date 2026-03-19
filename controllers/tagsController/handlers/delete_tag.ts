import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { TagsService } from '../service';

const logger = createChildLogger('tags-controller');
const service = new TagsService();

export async function deleteTag(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid tag ID' },
      });
    }

    await service.delete(id);

    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'DELETE /tags/:id failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
