import { FastifyReply, FastifyRequest } from 'fastify';

import {
  LoginApiResponse,
  LoginRequest,
  loginRequestSchema,
  PostLoginRoute,
} from '../../../types/api/account';
import { PostRefreshTokenRoute } from '../../../types/api/account';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import { AuthService } from '../service';

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export { PostLoginRoute };

export async function login(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const validatedData = loginRequestSchema.parse(request.body);

    const result = await authService.login(
      validatedData as LoginRequest,
      request
    );

    reply.setCookie('access_token', result.token, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: config.server.env === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    reply.setCookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: config.server.env === 'production' ? 'none' : 'lax',
      path: PostRefreshTokenRoute,
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    const tokenParts = result.token.split('.');
    const tokenPayload = tokenParts[1]
      ? JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
      : null;
    const expiresIn = tokenPayload?.exp
      ? tokenPayload.exp - Math.floor(Date.now() / 1000)
      : 604800;

    const response: LoginApiResponse = {
      success: true,
      data: {
        csrf_token: result.csrf_token,
        expires_in: expiresIn,
        user: {
          id: result.user.id.toString(),
          email: result.user.email,
          role: result.user.role,
          is_active: result.user.is_active,
        },
      },
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error, body: request.body }, 'Login failed');

    const response: LoginApiResponse = {
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error instanceof Error ? error.message : 'Login failed',
      },
    };

    return reply.status(401).send(response);
  }
}
