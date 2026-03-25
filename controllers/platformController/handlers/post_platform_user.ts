import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { createPlatformUserSchema } from '../models';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-post-user-handler');
const service = new PlatformService();

export async function postPlatformUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = createPlatformUserSchema.parse(request.body);
    const user = await service.createPlatformUser(body);

    return reply.status(201).send({ success: true, data: { user } });
  } catch (error) {
    logger.error({ error }, 'Create platform user failed');

    if (error instanceof Error && error.message === 'Email already registered') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Email already registered' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create platform user',
      },
    });
  }
}
