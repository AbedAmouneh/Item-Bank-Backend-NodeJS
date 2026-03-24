import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../../../utils/config';
import { AuditLogger } from '../../database/audit-logger';
import { AuthenticatedUser } from './auth';

interface DecodedToken {
  sub: number;
  email: string;
  role: string;
  is_active: boolean;
  iat: number;
  exp: number;
}

// Type guard to check if user exists on request
function hasUser(
  request: FastifyRequest
): request is FastifyRequest & { user: AuthenticatedUser } {
  return 'user' in request && request.user != null;
}

// Extract user ID directly from JWT token if not already processed by auth middleware
function extractUserIdFromToken(request: FastifyRequest): number | null {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(
      token,
      config.security.jwtSecret
    ) as DecodedToken;

    return decoded.sub || null;
  } catch {
    // Invalid or expired token
    return null;
  }
}

export async function auditContext(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Set audit context from request using AsyncLocalStorage
  // This will be available for the entire async call chain

  // First try to get user from request (if auth middleware already ran),
  // otherwise extract directly from the JWT token
  const userId = hasUser(request)
    ? request.user.id
    : extractUserIdFromToken(request);

  AuditLogger.setContext({
    userId,
    ipAddress: request.ip || 'unknown',
    userAgent: request.headers['user-agent'] || null,
    requestId: request.id,
  });
}
