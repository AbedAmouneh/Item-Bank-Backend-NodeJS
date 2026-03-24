// controllers/assessmentsController/handlers/post_violation.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ViolationSchema } from '../models';
import { AssessmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function logViolation(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const attemptId = parseInt((request.params as { attemptId: string }).attemptId, 10);
    if (isNaN(attemptId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid attempt ID' } });
    }
    const body = ViolationSchema.parse(request.body);
    await service.logViolation(attemptId, request.user.id, request.user.tenant_id, body.violation_type);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'POST /attempts/:attemptId/violations failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
