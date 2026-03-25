import { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import { platformLoginSchema } from '../models';
import { PlatformService } from '../service';

const logger = createChildLogger('platform-login-handler');
const service = new PlatformService();

export async function postPlatformLogin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = platformLoginSchema.parse(request.body);
    const { token, user } = await service.login(body);

    reply.setCookie('platform_access_token', token, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: config.server.env === 'production' ? 'none' : 'lax',
      path: '/platform',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return reply.status(200).send({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error({ error }, 'Platform login failed');
    return reply.status(401).send({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error instanceof Error ? error.message : 'Login failed',
      },
    });
  }
}
