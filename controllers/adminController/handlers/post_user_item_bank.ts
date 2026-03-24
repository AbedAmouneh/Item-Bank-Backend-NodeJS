import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function assignUserItemBank(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }

  try {
    const params = request.params as { id: string; itemBankId: string };
    const userId = parseInt(params.id, 10);
    const itemBankId = parseInt(params.itemBankId, 10);

    if (isNaN(userId) || isNaN(itemBankId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user ID or item bank ID' },
      });
    }

    const user = await adminService.findById(userId);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    await adminService.assignItemBank(userId, itemBankId, request.user.id);

    return reply.status(201).send({ success: true });
  } catch (error) {
    logger.error({ error }, 'POST /admin/users/:id/item-banks/:itemBankId failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
