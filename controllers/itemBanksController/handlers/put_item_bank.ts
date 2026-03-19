import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateItemBankSchema } from '../models';
import { ItemBanksService, PermissionError } from '../service';

const logger = createChildLogger('item-banks-controller');
const service = new ItemBanksService();

export async function updateItemBank(
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

    const body = UpdateItemBankSchema.parse(request.body);
    const itemBank = await service.update(id, body, request.user.id, request.user.role);

    return reply.status(200).send({ success: true, data: itemBank });
  } catch (error) {
    logger.error({ error }, 'PUT /item-banks/:id failed');

    if (error instanceof PermissionError) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
