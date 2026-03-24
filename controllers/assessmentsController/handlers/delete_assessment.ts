// controllers/assessmentsController/handlers/delete_assessment.ts
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssessmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function deleteAssessment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assessment ID' } });
    }
    await service.archiveAssessment(id, request.user.tenant_id);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'DELETE /assessments/:id failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
