import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ItemBanksService } from '../service';

const logger = createChildLogger('item-banks-controller');
const service = new ItemBanksService();

export async function deleteItemBank(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid item bank ID' },
      });
    }

    await service.softDelete(id, request.user.id, request.user.roles, request.user.tenant_id);

    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'DELETE /item-banks/:id failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
