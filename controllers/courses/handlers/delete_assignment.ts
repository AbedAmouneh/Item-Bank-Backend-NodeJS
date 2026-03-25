import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CoursesService } from '../service';

const logger = createChildLogger('courses-controller');
const service = new CoursesService();

export async function deleteAssignment(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const params = request.params as { id: string; userId: string };
    const id = parseInt(params.id, 10);
    const userId = parseInt(params.userId, 10);

    if (isNaN(id) || isNaN(userId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid course or user ID' },
      });
    }

    await service.unassignUser(id, userId, request.user.tenant_id);
    return reply.status(204).send();
  } catch (error) {
    logger.error({ error }, 'DELETE /courses/:id/assignments/:userId failed');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
