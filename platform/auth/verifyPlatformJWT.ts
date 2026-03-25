import jwt from 'jsonwebtoken';
import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  RouteShorthandOptions,
} from 'fastify';

import { db } from '../database/connection';
import { config } from '../../utils/config';
import { createChildLogger } from '../../utils/logger';

const logger = createChildLogger('platform-auth');

export type PlatformRole = 'super_admin' | 'sales';

export interface PlatformUser {
  id: number;
  email: string;
  platform_role: PlatformRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    platformUser?: PlatformUser;
  }
}

export interface AuthenticatedPlatformRequest extends FastifyRequest {
  platformUser: PlatformUser;
}

interface PlatformDecodedToken {
  sub: number;
  email: string;
  platform_role: PlatformRole;
  iat: number;
  exp: number;
}

function isPlatformDecodedToken(value: unknown): value is PlatformDecodedToken {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['sub'] === 'number' &&
    typeof v['email'] === 'string' &&
    (v['platform_role'] === 'super_admin' || v['platform_role'] === 'sales')
  );
}

export async function verifyPlatformJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = request.cookies['platform_access_token'];

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Platform access token required' },
      });
    }

    const raw = jwt.verify(token, config.security.platformJwtSecret);

    if (!isPlatformDecodedToken(raw)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Malformed platform token payload' },
      });
    }

    const result = await db.query<{
      id: number;
      email: string;
      platform_role: PlatformRole;
      is_active: boolean;
    }>(
      'SELECT id, email, platform_role, is_active FROM platform_users WHERE id = $1',
      [raw.sub]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Platform user not found or inactive' },
      });
    }

    request.platformUser = {
      id: user.id,
      email: user.email,
      platform_role: user.platform_role,
    };
  } catch (error) {
    logger.error({ error }, 'Platform authentication failed');

    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Platform access token has expired' },
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid platform access token' },
      });
    }

    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Authentication error' },
    });
  }
}

export function requirePlatformRole(role: PlatformRole) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.platformUser) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (request.platformUser.platform_role !== role) {
      logger.warn(
        {
          userId: request.platformUser.id,
          role: request.platformUser.platform_role,
          requiredRole: role,
        },
        'Insufficient platform role'
      );
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: `Role ${role} required` },
      });
    }
  };
}

type PreHandlerFn = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
type RouteHandler = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export class PlatformHttpWrapper {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private buildPreHandler(
    allowAnonymously: boolean,
    guards: PreHandlerFn[]
  ): PreHandlerFn[] {
    if (allowAnonymously) return guards;
    return [verifyPlatformJWT, ...guards];
  }

  private createOptions(
    allowAnonymously: boolean,
    guards: PreHandlerFn[],
    schema?: FastifySchema
  ): RouteShorthandOptions {
    const options: RouteShorthandOptions = {
      preHandler: this.buildPreHandler(allowAnonymously, guards),
    };
    if (schema) options.schema = schema;
    return options;
  }

  async get(
    path: string,
    handler: RouteHandler,
    allowAnonymously: boolean = false,
    guards: PreHandlerFn[] = [],
    schema?: FastifySchema
  ): Promise<void> {
    this.fastify.get(path, this.createOptions(allowAnonymously, guards, schema), handler);
  }

  async post(
    path: string,
    handler: RouteHandler,
    allowAnonymously: boolean = false,
    guards: PreHandlerFn[] = [],
    schema?: FastifySchema
  ): Promise<void> {
    this.fastify.post(path, this.createOptions(allowAnonymously, guards, schema), handler);
  }

  async patch(
    path: string,
    handler: RouteHandler,
    allowAnonymously: boolean = false,
    guards: PreHandlerFn[] = [],
    schema?: FastifySchema
  ): Promise<void> {
    this.fastify.patch(path, this.createOptions(allowAnonymously, guards, schema), handler);
  }

  register(
    plugin: (http: PlatformHttpWrapper) => Promise<void>,
    options?: { prefix?: string }
  ): ReturnType<FastifyInstance['register']> {
    return this.fastify.register(async fastify => {
      const nested = new PlatformHttpWrapper(fastify);
      await plugin(nested);
    }, options ?? {});
  }

  get instance(): FastifyInstance {
    return this.fastify;
  }
}
