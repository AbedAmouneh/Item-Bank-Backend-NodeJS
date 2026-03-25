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
    const rows = await service.getStats(request.user.id);

    const aggregated = {
      games_played: rows.reduce((sum, r) => sum + Number(r.sessions_played), 0),
      best_score: rows.reduce((max, r) => Math.max(max, r.best_score), 0),
      average_score:
        rows.length > 0
          ? Math.round(rows.reduce((sum, r) => sum + r.avg_accuracy, 0) / rows.length)
          : 0,
    };

    return reply.status(200).send({ success: true, data: aggregated });
  } catch (error) {
    logger.error({ error }, 'GET /game-sessions/my-stats failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
