import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateCategorySchema } from '../models';
import { CategoriesService } from '../service';

const logger = createChildLogger('categories-controller');
const service = new CategoriesService();

export async function createCategory(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.user.roles.includes('org_admin')) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const body = CreateCategorySchema.parse(request.body);
    const category = await service.create(body, request.user.id);

    return reply.status(201).send({ success: true, data: category });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
    }

    logger.error({ error }, 'POST /categories failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
