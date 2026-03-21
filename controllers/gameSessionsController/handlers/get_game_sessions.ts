import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { GameSessionListQuerySchema } from '../models';
import { GameSessionsService } from '../service';

const logger = createChildLogger('game-sessions-controller');
const service = new GameSessionsService();

export async function getGameSessions(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = GameSessionListQuerySchema.parse(request.query);
    const result = await service.findByUser(request.user.id, query);

    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'GET /game-sessions failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
