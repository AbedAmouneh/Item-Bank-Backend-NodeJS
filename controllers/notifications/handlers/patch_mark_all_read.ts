import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { NotificationsService } from '../service';

const logger = createChildLogger('notifications-controller');
const service = new NotificationsService();

export async function markAllNotificationsRead(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await service.markAllAsRead(request.user.id);
    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'PATCH /notifications/read-all failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
