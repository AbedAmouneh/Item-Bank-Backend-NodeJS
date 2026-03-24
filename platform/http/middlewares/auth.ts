import jwt from 'jsonwebtoken';
import { FastifyReply, FastifyRequest } from 'fastify';

import { db } from '../../../platform/database/connection';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('auth-middleware');

export interface AuthenticatedUser {
  id: number;
  email: string;
  tenant_id: number;
  roles: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    _startTime?: number;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export interface DecodedToken {
  sub: number;
  email: string;
  role: string;
  is_active: boolean;
  iat: number;
  exp: number;
}

async function loadUserContext(
  userId: number
): Promise<{ tenant_id: number; is_active: boolean; roles: string[] } | null> {
  const userRow = await db.query<{ tenant_id: number; is_active: boolean }>(
    'SELECT tenant_id, is_active FROM users WHERE id = $1',
    [userId]
  );
  const user = userRow.rows[0];
  if (!user) return null;

  const rolesRow = await db.query<{ role: string }>(
    'SELECT role FROM user_roles WHERE user_id = $1 AND tenant_id = $2',
    [userId, user.tenant_id]
  );

  return {
    tenant_id: user.tenant_id,
    is_active: user.is_active,
    roles: rolesRow.rows.map(r => r.role),
  };
}

export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = request.cookies['access_token'];

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
    }

    const decoded = jwt.verify(token, config.security.jwtSecret) as DecodedToken;

    const context = await loadUserContext(decoded.sub);

    if (!context) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    if (!context.is_active) {
      return reply.status(401).send({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
    }

    request.user = {
      id: decoded.sub,
      email: decoded.email,
      tenant_id: context.tenant_id,
      roles: context.roles,
    };

    logger.debug(
      { userId: decoded.sub, tenant_id: context.tenant_id },
      'User authenticated successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Authentication failed');

    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Authentication error' },
    });
  }
}

export function requireRole(requiredRole: string) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!request.user.roles.includes(requiredRole)) {
      logger.warn(
        { userId: request.user.id, roles: request.user.roles, requiredRole },
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
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
  };
}

export function requireAnyRole(roles: string[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!request.user.roles.some(r => roles.includes(r))) {
      logger.warn(
        { userId: request.user.id, roles: request.user.roles, requiredRoles: roles },
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

export function requireSuperAdmin() {
  return requireRole('org_admin');
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const token = request.cookies['access_token'];
    if (!token) return;

    const decoded = jwt.verify(token, config.security.jwtSecret) as DecodedToken;

    const context = await loadUserContext(decoded.sub);
    if (context?.is_active) {
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        tenant_id: context.tenant_id,
        roles: context.roles,
      };
    }
  } catch (error) {
    logger.debug({ error }, 'Optional authentication failed');
  }
}
