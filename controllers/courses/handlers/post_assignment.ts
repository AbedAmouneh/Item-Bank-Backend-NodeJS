import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateAssignmentSchema } from '../models';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function createAssignment(
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

    const body = CreateAssignmentSchema.parse(request.body);
    const assignment = await service.assignUser(id, body.user_id, request.user.id, body.due_at);
    return reply.status(201).send({ success: true, data: assignment });
  } catch (error) {
    logger.error({ error }, 'POST /courses/:id/assignments failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
