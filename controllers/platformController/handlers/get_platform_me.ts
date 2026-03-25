import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-me-handler');
const service = new PlatformService();

export async function getPlatformMe(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = await service.getMe(request.platformUser!.id);
    return reply.status(200).send({ success: true, data: { user } });
  } catch (error) {
    logger.error({ error }, 'Get platform me failed');
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error instanceof Error ? error.message : 'Not found',
      },
    });
  }
}
