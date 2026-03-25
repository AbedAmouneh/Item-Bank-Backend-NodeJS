import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-tenant-handler');
const service = new PlatformService();

export async function getTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const tenantId = parseInt(id, 10);

    if (isNaN(tenantId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_PARAM', message: 'Invalid tenant id' },
      });
    }

    const tenant = await service.getTenant(tenantId);
    return reply.status(200).send({ success: true, data: { tenant } });
  } catch (error) {
    logger.error({ error }, 'Get tenant failed');

    if (error instanceof Error && error.message === 'Tenant not found') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant not found' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get tenant' },
    });
  }
}
