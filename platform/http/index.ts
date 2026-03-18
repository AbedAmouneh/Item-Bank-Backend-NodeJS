import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  RouteShorthandOptions,
} from 'fastify';

import {
  AuthenticatedRequest,
  authenticateToken,
  optionalAuth,
} from './middlewares/auth';
import { requireAuthentication } from './middlewares/security';

export type HttpHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;
export type AuthenticatedHttpHandler = (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => Promise<void>;

export class HttpWrapper {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private async combinedAuthMiddleware(allowAnonymously: boolean) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      if (allowAnonymously) {
        // For public routes: try to authenticate but don't require it
        await optionalAuth(request, reply);
      } else {
        // For protected routes: authenticate and require user
        await authenticateToken(request, reply);
        if (reply.sent) return; // If auth failed, response already sent
        await requireAuthentication(request, reply);
      }
    };
  }

  private async createOptions(
    allowAnonymously: boolean,
    schema?: FastifySchema
  ): Promise<RouteShorthandOptions> {
    const options: RouteShorthandOptions = {};

    options.preHandler = await this.combinedAuthMiddleware(allowAnonymously);

    if (schema) {
      options.schema = schema;
    }

    return options;
  }

  async get(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.get(path, options, handler as HttpHandler);
  }

  async post(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.post(path, options, handler as HttpHandler);
  }

  async put(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.put(path, options, handler as HttpHandler);
  }

  async patch(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.patch(path, options, handler as HttpHandler);
  }

  async delete(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.delete(path, options, handler as HttpHandler);
  }

  async head(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.head(path, options, handler as HttpHandler);
  }

  async options(
    path: string,
    handler: HttpHandler | AuthenticatedHttpHandler,
    allowAnonymously: boolean = false,
    schema?: FastifySchema
  ) {
    const options = await this.createOptions(allowAnonymously, schema);
    this.fastify.options(path, options, handler as HttpHandler);
  }

  // Method to register a nested route group
  register(
    plugin: (http: HttpWrapper) => Promise<void>,
    options?: { prefix?: string }
  ) {
    return this.fastify.register(async fastify => {
      const nestedHttp = new HttpWrapper(fastify);
      await plugin(nestedHttp);
    }, options || {});
  }

  // Direct access to the underlying Fastify instance if needed
  get instance() {
    return this.fastify;
  }
}
