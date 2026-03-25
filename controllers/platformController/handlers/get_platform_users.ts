import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-users-handler');
const service = new PlatformService();

export async function getPlatformUsers(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const users = await service.listPlatformUsers();
    return reply.status(200).send({ success: true, data: { users } });
  } catch (error) {
    logger.error({ error }, 'List platform users failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list platform users' },
    });
  }
}
