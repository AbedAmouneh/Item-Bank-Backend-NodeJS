// controllers/assignmentsController/handlers/get_submission.ts
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssignmentsService, ForbiddenError, NotFoundError } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function getSubmission(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id, subId } = request.params as { id: string; subId: string };
    const assignmentId = parseInt(id, 10);
    const submissionId = parseInt(subId, 10);
    if (isNaN(assignmentId) || isNaN(submissionId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    }
    const submission = await service.getSubmission(
      submissionId,
      assignmentId,
      request.user.id,
      request.user.roles,
      request.user.tenant_id,
    );
    return reply.status(200).send({ success: true, data: submission });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error instanceof ForbiddenError) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
    }
    logger.error({ error }, 'GET /assignments/:id/submissions/:subId failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
