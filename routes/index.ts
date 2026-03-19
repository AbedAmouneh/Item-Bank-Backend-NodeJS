import { FastifyInstance } from 'fastify';

import { authRoutes } from '../controllers/authController';
import { itemBankRoutes } from '../controllers/itemBanksController';
import { questionRoutes } from '../controllers/questionsController';
import { tagRoutes } from '../controllers/tagsController';
import { HttpWrapper } from '../platform/http';
import {
  httpLoggingMiddleware,
  httpLoggingOnResponse,
} from '../platform/http/logs';
import {
  auditLog,
  securityHeaders,
} from '../platform/http/middlewares/security';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Track request start time
  await fastify.addHook('onRequest', async request => {
    request._startTime = Date.now();
  });

  // HTTP request logging - capture response body
  await fastify.addHook('onRequest', httpLoggingMiddleware);

  // HTTP request logging - log after response is sent
  await fastify.addHook('onResponse', httpLoggingOnResponse);

  // Global middleware
  await fastify.addHook('preHandler', securityHeaders);
  await fastify.addHook('preHandler', auditLog);

  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({ ok: true });
  });

  const http = new HttpWrapper(fastify);
  await http.register(authRoutes);
  await http.register(itemBankRoutes);
  await http.register(questionRoutes);
  await http.register(tagRoutes);
}
