import { FastifyReply } from 'fastify';

import { GetMeApiResponse, GetMeRoute } from '../../../types/api/account';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { AuthService } from '../service';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export { GetMeRoute };

export async function getMe(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id, tenant_id } = request.user;
    const data = await authService.getMe(id, tenant_id);

    const response: GetMeApiResponse = {
      success: true,
      data,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Get me failed');
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Unauthorized',
      },
    });
  }
}
