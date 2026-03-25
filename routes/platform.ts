import { FastifyInstance } from 'fastify';

import { PlatformHttpWrapper } from '../platform/auth/verifyPlatformJWT';
import { platformRoutes } from '../controllers/platformController';

export async function registerPlatformRoutes(fastify: FastifyInstance): Promise<void> {
  const http = new PlatformHttpWrapper(fastify);
  await platformRoutes(http);
}
