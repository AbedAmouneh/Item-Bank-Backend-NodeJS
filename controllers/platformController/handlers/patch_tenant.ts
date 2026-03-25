import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { patchTenantSchema } from '../models';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-patch-tenant-handler');
const service = new PlatformService();

export async function patchTenant(
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

    const body = patchTenantSchema.parse(request.body);
    const tenant = await service.patchTenant(tenantId, body);

    return reply.status(200).send({ success: true, data: { tenant } });
  } catch (error) {
    logger.error({ error }, 'Patch tenant failed');

    if (error instanceof Error && error.message === 'Tenant not found') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tenant not found' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update tenant',
      },
    });
  }
}
