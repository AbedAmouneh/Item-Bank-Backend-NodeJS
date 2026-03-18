import { FastifyReply, FastifyRequest } from 'fastify';

import { ApiResponse } from '../../../types/common';

export async function auditLog(
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // This is just a preHandler hook, the actual logging is done in the main server
  // We'll just continue to the next handler
}

export async function validateContentType(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const contentType = request.headers['content-type'];

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    if (!contentType || !contentType.includes('application/json')) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json',
        },
      });
    }
  }
}

export async function requestSizeLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const contentLength = request.headers['content-length'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    return reply.status(413).send({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body too large',
      },
    });
  }
}

export async function securityHeaders(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
}

export async function requireAuthentication(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    };
    return reply.status(401).send(response);
  }
}
