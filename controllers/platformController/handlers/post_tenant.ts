import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { createTenantSchema } from '../models';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-post-tenant-handler');
const service = new PlatformService();

export async function postTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = createTenantSchema.parse(request.body);
    const result = await service.createTenant(body);

    return reply.status(201).send({
      success: true,
      data: {
        tenant: result.tenant,
        admin_credentials: {
          email: result.admin_email,
          temp_password: result.temp_password,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Create tenant failed');

    if (error instanceof Error && error.message.includes('unique')) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: 'Tenant slug already exists' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create tenant',
      },
    });
  }
}
