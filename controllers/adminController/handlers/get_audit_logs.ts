import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { AuditLog, AuditLogQuerySchema } from '../models';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function getAuditLogs(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = AuditLogQuerySchema.parse(request.query);
    const result = await adminService.getAuditLogs(query);

    const response: ApiResponse<{
      items: AuditLog[];
      total: number;
      page: number;
      limit: number;
    }> = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'GET /admin/audit-logs failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
