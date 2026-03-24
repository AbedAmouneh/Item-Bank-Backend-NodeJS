import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { NotificationsService } from '../service';

const logger = createChildLogger('notifications-controller');
const service = new NotificationsService();

export async function markNotificationRead(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const notificationId = parseInt(id, 10);

    if (isNaN(notificationId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid notification id' },
      });
    }

    const found = await service.markAsRead(notificationId, request.user.id, request.user.tenant_id);

    if (!found) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }

    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'PATCH /notifications/:id/read failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
