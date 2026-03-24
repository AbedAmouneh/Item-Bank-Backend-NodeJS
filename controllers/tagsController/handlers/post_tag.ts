import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateTagSchema } from '../models';
import { TagsService } from '../service';

const logger = createChildLogger('tags-controller');
const service = new TagsService();

export async function createTag(
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

    const body = CreateTagSchema.parse(request.body);
    const tag = await service.create(body);

    return reply.status(201).send({ success: true, data: tag });
  } catch (error) {
    logger.error({ error }, 'POST /tags failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
