import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssignmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function deleteAssignment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user.roles.includes('teacher') && !request.user.roles.includes('org_admin')) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Teacher or admin role required' } });
  }
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assignment ID' } });
    }
    await service.deleteAssignment(id, request.user.tenant_id);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'DELETE /assignments/:id failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
