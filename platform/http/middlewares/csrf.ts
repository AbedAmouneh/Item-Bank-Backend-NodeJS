import { FastifyReply, FastifyRequest } from 'fastify';

import { validateCsrfToken } from '../../../utils/csrf';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('csrf-middleware');

/**
 * CSRF validation middleware
 * Validates CSRF tokens on all state-changing operations (POST, PUT, PATCH, DELETE)
 * Skips validation for GET, HEAD, and OPTIONS requests
 */
export async function validateCsrf(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip CSRF validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }

  // Skip CSRF validation for:
  // - login/refresh endpoints (they issue CSRF tokens)
  // - ping endpoint (auth-protected heartbeat)
  const skipPaths = ['/auth/login', '/auth/refresh-token', '/ping'];
  if (skipPaths.some(path => request.url.includes(path))) {
    return;
  }

  // Get CSRF token from header
  const csrfToken = request.headers['x-csrf-token'] as string;
  if (!csrfToken) {
    logger.warn(
      { url: request.url, method: request.method },
      'CSRF token missing'
    );
    return reply.code(403).send({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required',
      },
    });
  }

  // Get access token from cookie
  const accessToken = request.cookies?.['access_token'];
  if (!accessToken) {
    logger.warn(
      { url: request.url, method: request.method },
      'Access token missing for CSRF validation'
    );
    return reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  // Validate CSRF token against session
  const isValid = await validateCsrfToken(accessToken, csrfToken);
  if (!isValid) {
    logger.warn(
      { url: request.url, method: request.method },
      'Invalid CSRF token'
    );
    return reply.code(403).send({
      success: false,
      error: {
        code: 'INVALID_CSRF_TOKEN',
        message: 'Invalid CSRF token',
      },
    });
  }

  // CSRF token is valid, continue
  logger.debug({ url: request.url, method: request.method }, 'CSRF validated');
}
