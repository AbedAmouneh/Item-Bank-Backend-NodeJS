import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ItemBanksService } from '../service';

const logger = createChildLogger('item-banks-controller');
const service = new ItemBanksService();

export async function getItemBank(
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

    const itemBank = await service.findById(id, request.user.id, request.user.role);

    if (!itemBank) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Item bank not found' },
      });
    }

    return reply.status(200).send({ success: true, data: itemBank });
  } catch (error) {
    logger.error({ error }, 'GET /item-banks/:id failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
