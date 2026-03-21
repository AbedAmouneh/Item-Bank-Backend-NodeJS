import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { LeaderboardQuerySchema } from '../models';
import { GameSessionsService } from '../service';

const logger = createChildLogger('game-sessions-controller');
const service = new GameSessionsService();

export async function getLeaderboard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = LeaderboardQuerySchema.parse(request.query);
    const result = await service.leaderboard(query);

    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'GET /leaderboard failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
