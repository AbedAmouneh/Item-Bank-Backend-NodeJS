import { FastifyReply, FastifyRequest } from 'fastify';

import { PostRefreshTokenRoute } from '../../../types/api/account';
import { ApiResponse } from '../../../types/common';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import { AuthService } from '../service';

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export async function refreshToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get refresh token from cookie instead of body
    const refreshToken = request.cookies['refresh_token'];

    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const result = await authService.refreshToken(refreshToken);

    // Set new access token as HttpOnly cookie
    reply.setCookie('access_token', result.token, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: config.server.env === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    // Set new refresh token as HttpOnly cookie
    reply.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: config.server.env === 'production' ? 'none' : 'lax',
      path: PostRefreshTokenRoute,
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    // Only return CSRF token (no tokens in response body)
    const response: ApiResponse = {
      success: true,
      data: {
        csrf_token: result.csrf_token,
      },
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Token refresh failed');

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TOKEN_REFRESH_FAILED',
        message:
          error instanceof Error ? error.message : 'Token refresh failed',
      },
    };

    return reply.status(401).send(response);
  }
}
