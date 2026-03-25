import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function revokeUserItemBank(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const params = request.params as { id: string; itemBankId: string };
    const id = parseInt(params.id, 10);
    const itemBankId = parseInt(params.itemBankId, 10);

    if (isNaN(id) || isNaN(itemBankId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user ID or item bank ID' },
      });
    }

    const removed = await adminService.revokeItemBank(id, itemBankId);

    if (!removed) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assignment not found' },
      });
    }

    return reply.status(200).send({ success: true });
  } catch (error) {
    logger.error({ error }, 'DELETE /admin/users/:id/item-banks/:itemBankId failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
