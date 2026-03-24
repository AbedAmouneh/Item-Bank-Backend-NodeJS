// controllers/assessmentsController/handlers/post_submit_attempt.ts
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssessmentsService, ConflictError, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function submitAttempt(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const attemptId = parseInt((request.params as { attemptId: string }).attemptId, 10);
    if (isNaN(attemptId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid attempt ID' } });
    }
    const attempt = await service.submitAttempt(attemptId, request.user.id, request.user.tenant_id);
    return reply.status(200).send({ success: true, data: attempt });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: error.message } });
    }
    logger.error({ error }, 'POST /attempts/:attemptId/submit failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
