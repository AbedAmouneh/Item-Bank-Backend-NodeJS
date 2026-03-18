import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { isBlockedUrl, isBlockedUserAgent } from '../security-patterns';

const logger = createChildLogger('security-filter');

export async function securityFilter(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const url = request.url;
  const userAgent = request.headers['user-agent'] || '';
  const ip = request.ip;

  // Handle favicon.ico requests without logging
  if (url === '/favicon.ico') {
    return reply.status(204).send('');
  }

  // Check if URL matches blocked patterns
  const blockedUrl = isBlockedUrl(url);

  // Check if user agent matches blocked patterns
  const blockedUserAgent = isBlockedUserAgent(userAgent);

  if (blockedUrl || blockedUserAgent) {
    logger.warn(
      {
        url,
        userAgent,
        ip,
        reason: blockedUrl ? 'blocked_url_pattern' : 'blocked_user_agent',
      },
      'Blocked malicious/scanning request'
    );

    // Return 404 to not reveal that we're blocking intentionally
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  }
}
