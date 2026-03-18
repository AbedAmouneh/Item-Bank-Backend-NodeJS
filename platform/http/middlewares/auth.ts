import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';

import { Role } from '../../../types/common';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('auth-middleware');

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    _startTime?: number;
  }
}

// Type for requests that are guaranteed to have an authenticated user
export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
  is_active: boolean;
  iat: number;
  exp: number;
}

export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Read token from cookie instead of Authorization header
    const token = request.cookies['access_token'];

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
        },
      });
    }

    const decoded = jwt.verify(
      token,
      config.security.jwtSecret
    ) as unknown as JwtPayload;

    if (!decoded.is_active) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is disabled',
        },
      });
    }

    request.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      is_active: decoded.is_active,
    };

    logger.debug(
      {
        userId: decoded.sub,
        role: decoded.role,
      },
      'User authenticated successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Authentication failed');

    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token',
        },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
      },
    });
  }
}

export function requireRole(requiredRole: Role) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (request.user.role !== requiredRole) {
      logger.warn(
        {
          userId: request.user.id,
          userRole: request.user.role,
          requiredRole,
        },
        'Insufficient role permissions'
      );

      return reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Role ${requiredRole} required`,
        },
      });
    }
  };
}

export function requirePermission(_permission?: string) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }
  };
}

export function requireAnyRole(roles: Role[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(request.user.role)) {
      logger.warn(
        {
          userId: request.user.id,
          userRole: request.user.role,
          requiredRoles: roles,
        },
        'Insufficient role permissions'
      );

      return reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `One of the following roles required: ${roles.join(', ')}`,
        },
      });
    }
  };
}

// Admin only
export function requireSuperAdmin() {
  return requireRole('admin');
}

// Optional authentication - doesn't fail if no token provided
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    // Read token from cookie instead of Authorization header
    const token = request.cookies['access_token'];

    if (!token) {
      // No token provided, but that's okay for optional auth
      return;
    }

    const decoded = jwt.verify(
      token,
      config.security.jwtSecret
    ) as unknown as JwtPayload;

    if (decoded.is_active) {
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        is_active: decoded.is_active,
      };
    }
  } catch (error) {
    // Token provided but invalid - that's okay for optional auth
    logger.debug({ error }, 'Optional authentication failed');
  }
}
