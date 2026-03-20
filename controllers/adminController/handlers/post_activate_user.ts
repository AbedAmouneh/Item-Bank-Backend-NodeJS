import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function activateUser(
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
    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user ID' },
      });
    }

    await adminService.activate(id);

    const response: ApiResponse<null> = { success: true, data: null };
    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'POST /admin/users/:id/activate failed');

    return reply.status(400).send({
      success: false,
      error: {
        code: 'ACTIVATE_USER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to activate user',
      },
    });
  }
}
