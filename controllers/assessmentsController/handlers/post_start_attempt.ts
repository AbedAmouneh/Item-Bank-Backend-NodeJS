// controllers/assessmentsController/handlers/post_start_attempt.ts
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssessmentsService, ConflictError, MaxAttemptsError, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function startAttempt(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assessment ID' } });
    }
    const attempt = await service.startAttempt(id, request.user.id, request.user.tenant_id);
    return reply.status(201).send({ success: true, data: attempt });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error instanceof MaxAttemptsError) {
      return reply.status(403).send({ success: false, error: { code: 'MAX_ATTEMPTS_REACHED', message: error.message } });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: error.message } });
    }
    logger.error({ error }, 'POST /assessments/:id/attempts failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
