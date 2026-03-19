import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { TagListQuerySchema } from '../models';
import { TagsService } from '../service';

const logger = createChildLogger('tags-controller');
const service = new TagsService();

export async function getTags(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = TagListQuerySchema.parse(request.query);
    const result = await service.findAll(query);

    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'GET /tags failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
