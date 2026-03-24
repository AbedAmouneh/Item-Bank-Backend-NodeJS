import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateCourseSchema } from '../models';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function updateCourse(
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

    const body = UpdateCourseSchema.parse(request.body);
    const course = await service.update(id, body, request.user.tenant_id);

    if (!course) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Course not found' },
      });
    }

    return reply.status(200).send({ success: true, data: course });
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

    logger.error({ error }, 'PUT /courses/:id failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
