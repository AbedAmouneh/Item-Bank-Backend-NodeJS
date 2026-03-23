import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { GameSessionsService } from '../service';

const logger = createChildLogger('game-sessions-controller');
const service = new GameSessionsService();

export async function getMyStats(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const stats = await service.getStats(request.user.id);

    return reply.status(200).send({ success: true, data: stats });
  } catch (error) {
    logger.error({ error }, 'GET /game-sessions/stats/me failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
