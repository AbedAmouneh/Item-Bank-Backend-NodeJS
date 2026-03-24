import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AnalyticsService } from '../service';

const logger = createChildLogger('analytics-controller');
const service = new AnalyticsService();

export async function getOverview(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.user.roles.includes('org_admin')) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    const data = await service.getOverview(request.user.tenant_id);
    return reply.status(200).send({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'GET /analytics/overview failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
