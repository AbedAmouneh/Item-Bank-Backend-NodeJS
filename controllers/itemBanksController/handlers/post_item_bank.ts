import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateItemBankSchema } from '../models';
import { ItemBanksService } from '../service';

const logger = createChildLogger('item-banks-controller');
const service = new ItemBanksService();

export async function createItemBank(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = CreateItemBankSchema.parse(request.body);
    const itemBank = await service.create(body, request.user.id);

    return reply.status(201).send({ success: true, data: itemBank });
  } catch (error) {
    logger.error({ error }, 'POST /item-banks failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
