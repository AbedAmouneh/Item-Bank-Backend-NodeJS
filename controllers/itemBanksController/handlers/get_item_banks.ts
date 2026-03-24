import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ItemBankListQuerySchema } from '../models';
import { ItemBanksService } from '../service';

const logger = createChildLogger('item-banks-controller');
const service = new ItemBanksService();

export async function getItemBanks(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = ItemBankListQuerySchema.parse(request.query);
    const result = await service.findAll(request.user.id, request.user.roles, request.user.tenant_id, query);

    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'GET /item-banks failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
