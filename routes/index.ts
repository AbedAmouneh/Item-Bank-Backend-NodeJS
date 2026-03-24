import { FastifyInstance } from 'fastify';

import { adminRoutes } from '../controllers/adminController';
import { analyticsRoutes } from '../controllers/analyticsController';
import { assessmentRoutes } from './assessments';
import { authRoutes } from '../controllers/authController';
import { categoryRoutes } from '../controllers/categoriesController';
import { courseRoutes } from '../controllers/courses';
import { gameSessionRoutes } from '../controllers/gameSessionsController';
import { itemBankRoutes } from '../controllers/itemBanksController';
import { mediaRoutes } from '../controllers/mediaController';
import { notificationRoutes } from '../controllers/notifications';
import { profileRoutes } from '../controllers/profileController';
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
  await http.register(adminRoutes);
  await http.register(analyticsRoutes);
  await http.register(assessmentRoutes);
  await http.register(authRoutes);
  await http.register(categoryRoutes);
  await http.register(courseRoutes);
  await http.register(gameSessionRoutes);
  await http.register(itemBankRoutes);
  await http.register(mediaRoutes);
  await http.register(notificationRoutes);
  await http.register(profileRoutes);
  await http.register(questionRoutes);
  await http.register(tagRoutes);
}
