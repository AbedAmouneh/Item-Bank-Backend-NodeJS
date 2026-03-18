import { FastifyReply, FastifyRequest } from 'fastify';

import { PostRefreshTokenRoute } from '../../../types/api/account';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { AuthService } from '../service';

export const PostLogoutRoute = '/logout';

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from cookie instead of Authorization header
    const token = request.cookies['access_token'];

    if (token) {
      await authService.logout(token);
    }

    // Clear cookies
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: PostRefreshTokenRoute });

    const response: ApiResponse = {
      success: true,
      meta: {
        message: 'Logged out successfully',
      },
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Logout failed');

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Logout failed',
      },
    };

    return reply.status(400).send(response);
  }
}
