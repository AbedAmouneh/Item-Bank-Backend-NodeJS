import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { AdminUser, AdminUserListQuerySchema } from '../models';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function getUsers(
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
    const query = AdminUserListQuerySchema.parse(request.query);
    const result = await adminService.findAll(query);

    const response: ApiResponse<{
      items: AdminUser[];
      total: number;
      page: number;
      limit: number;
    }> = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'GET /admin/users failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
