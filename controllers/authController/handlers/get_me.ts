import { FastifyReply } from 'fastify';

import { GetMeApiResponse, GetMeRoute } from '../../../types/api/account';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('auth-controller');

export { GetMeRoute };

export async function getMe(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id, email, tenant_id, roles } = request.user;

    const response: GetMeApiResponse = {
      success: true,
      data: { id: id.toString(), email, tenant_id, roles },
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
