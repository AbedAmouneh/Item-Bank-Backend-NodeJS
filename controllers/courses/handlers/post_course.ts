import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateCourseSchema } from '../models';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function createCourse(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = CreateCourseSchema.parse(request.body);
    const course = await service.create(body, request.user.id);
    return reply.status(201).send({ success: true, data: course });
  } catch (error) {
    logger.error({ error }, 'POST /courses failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
