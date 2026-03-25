import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import path from 'path';

import { registerRoutes } from '../../routes';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';
import { corsConfig } from './cors';
import { auditContext } from './middlewares/audit-context';
import { validateCsrf } from './middlewares/csrf';
import {
  cacheIdempotentResponse,
  idempotencyMiddleware,
} from './middlewares/idempotency';
import { inputSanitization } from './middlewares/input-sanitization';
import { securityFilter } from './middlewares/security-filter';
import { swaggerConfig, swaggerUIConfig } from './swagger-config';

export class WebServer {
  private fastify: FastifyInstance;

  constructor() {
    this.fastify = Fastify({
      logger: {
        level: config.logging.level,
        redact: {
          paths: ['password', 'token', 'authorization', 'secret'],
          censor: '[REDACTED]',
        },
        ...(config.logging.pretty &&
          config.server.env === 'development' && {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }),
      },
      disableRequestLogging: true,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'requestId',
      genReqId: () => {
        return Math.random().toString(36).substring(2, 15);
      },
    });

    this.setupErrorHandler();
  }

  private async setupMiddleware(): Promise<void> {
    // Register swagger first
    await this.fastify.register(swagger, swaggerConfig);

    if (config.server.env === 'development') {
      await this.fastify.register(swaggerUI, swaggerUIConfig);
    }

    // Register security plugins
    await this.fastify.register(helmet, {
      contentSecurityPolicy: false,
    });

    await this.fastify.register(cors, corsConfig);

    // Register cookie support BEFORE hooks that need cookies
    await this.fastify.register(cookie, {
      secret: config.security.cookieSecret || config.security.jwtSecret,
      parseOptions: {
        httpOnly: true,
        secure: config.server.env === 'production',
        // sameSite 'none' requires secure:true, so use 'lax' for local dev
        sameSite: config.server.env === 'production' ? 'none' : 'lax',
      },
    });

    // NOW register hooks that depend on cookies
    // Register security filter first to block malicious requests early
    this.fastify.addHook('onRequest', securityFilter);

    // Sanitize all input data after security filter
    this.fastify.addHook('onRequest', inputSanitization);

    // Register audit context to capture user info for database queries
    this.fastify.addHook('onRequest', auditContext);

    // Register CSRF validation for state-changing operations
    this.fastify.addHook('onRequest', validateCsrf);

    // Register idempotency middleware for duplicate request detection
    this.fastify.addHook('onRequest', idempotencyMiddleware);

    // Cache successful idempotent responses
    this.fastify.addHook('onSend', cacheIdempotentResponse);

    await this.fastify.register(rateLimit, {
      max: config.security.rateLimit.max,
      timeWindow: config.security.rateLimit.window,
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      }),
    });

    // Register multipart support for file uploads
    await this.fastify.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 1, // Allow only 1 file per request
      },
    });

    // Serve uploaded audio files
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await this.fastify.register(staticFiles, {
      root: uploadsDir,
      prefix: '/uploads/',
      decorateReply: false,
    });

    // Register response compression for JSON/text after idempotency cache so we
    // always store raw JSON in Redis, never compressed bytes.
    await this.fastify.register(compress, {
      global: true,
      threshold: 1024,
      encodings: ['br', 'gzip', 'deflate'],
      // Only compress JSON and text — skip binary exports (xlsx, pdf, csv streams)
      customTypes: /^(application\/json|text\/.*)$/,
    });

    // JSON body parsing
    this.fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req, body, done) => {
        try {
          const bodyString = body as string;
          if (!bodyString || bodyString.trim() === '') {
            done(null, {});
            return;
          }
          const json = JSON.parse(bodyString);
          done(null, json);
        } catch {
          done(new Error('Invalid JSON'), undefined);
        }
      }
    );
  }

  private setupErrorHandler(): void {
    this.fastify.setErrorHandler((error: FastifyError, request, reply) => {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          requestId: request.id,
          method: request.method,
          url: request.url,
        },
        'Request error'
      );

      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.validation,
            requestId: request.id,
          },
        });
      }

      if (error.statusCode) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            code: 'REQUEST_ERROR',
            message: error.message,
            requestId: request.id,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        },
      });
    });
  }

  /**
   * Gracefully close the web server
   * - Stops accepting new connections
   * - Waits for in-flight requests to complete (up to Fastify's default timeout)
   * - Closes all resources
   */
  async close(): Promise<void> {
    logger.info('Closing web server...');

    try {
      // Fastify.close() will:
      // 1. Stop the server from accepting new connections
      // 2. Wait for all in-flight requests to complete
      // 3. Close all connections
      await this.fastify.close();
      logger.info('Web server closed successfully');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : error },
        'Error closing web server'
      );
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      // Setup middleware
      await this.setupMiddleware();

      // Register routes
      await registerRoutes(this.fastify);

      // Start server
      const displayHost =
        config.server.host === '0.0.0.0' ? 'localhost' : config.server.host;

      await this.fastify.listen({
        port: config.server.port,
        host: config.server.host,
      });

      logger.info(
        {
          env: config.server.env,
          port: config.server.port,
          host: config.server.host,
        },
        `Server listening at http://${displayHost}:${config.server.port}`
      );
    } catch (error) {
      logger.error({ error }, 'Server startup failed');
      process.exit(1);
    }
  }

  get instance(): FastifyInstance {
    return this.fastify;
  }
}
