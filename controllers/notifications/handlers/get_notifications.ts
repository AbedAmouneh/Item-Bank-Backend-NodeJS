import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { NotificationsService } from '../service';

const logger = createChildLogger('notifications-controller');
const service = new NotificationsService();

export async function getNotifications(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const notifications = await service.getForUser(request.user.id, request.user.tenant_id);
    return reply.status(200).send({ success: true, data: notifications });
  } catch (error) {
    logger.error({ error }, 'GET /notifications failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
