import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateGameSessionSchema } from '../models';
import { GameSessionsService } from '../service';

const logger = createChildLogger('game-sessions-controller');
const service = new GameSessionsService();

export async function createGameSession(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = CreateGameSessionSchema.parse(request.body);
    const session = await service.create(body, request.user.id);

    return reply.status(201).send({ success: true, data: session });
  } catch (error) {
    logger.error({ error }, 'POST /game-sessions failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
