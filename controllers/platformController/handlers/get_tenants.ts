import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-tenants-handler');
const service = new PlatformService();

export async function getTenants(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const tenants = await service.listTenants();
    return reply.status(200).send({ success: true, data: { tenants } });
  } catch (error) {
    logger.error({ error }, 'List tenants failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list tenants' },
    });
  }
}
