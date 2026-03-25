import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateActivitySchema } from '../models';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function createActivity(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid course ID' },
      });
    }

    const body = CreateActivitySchema.parse(request.body);
    const activity = await service.createActivity(id, body, request.user.tenant_id);
    return reply.status(201).send({ success: true, data: activity });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
    }

    logger.error({ error }, 'POST /courses/:id/activities failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
