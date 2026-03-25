import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateActivitySchema } from '../models';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function updateActivity(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const params = request.params as { id: string; actId: string };
    const id = parseInt(params.id, 10);
    const actId = parseInt(params.actId, 10);

    if (isNaN(id) || isNaN(actId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid course or activity ID' },
      });
    }

    const body = UpdateActivitySchema.parse(request.body);
    const activity = await service.updateActivity(id, actId, body, request.user.tenant_id);

    if (!activity) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Activity not found' },
      });
    }

    return reply.status(200).send({ success: true, data: activity });
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

    logger.error({ error }, 'PUT /courses/:id/activities/:actId failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
