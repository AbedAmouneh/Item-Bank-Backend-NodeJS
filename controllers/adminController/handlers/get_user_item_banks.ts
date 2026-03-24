import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { UserItemBankAccess } from '../models';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function getUserItemBanks(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user.roles.includes('org_admin')) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }

  try {
    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user ID' },
      });
    }

    const user = await adminService.findById(id);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const items = await adminService.listUserItemBanks(id);
    const response: ApiResponse<UserItemBankAccess[]> = { success: true, data: items };
    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'GET /admin/users/:id/item-banks failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
