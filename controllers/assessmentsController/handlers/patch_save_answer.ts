// controllers/assessmentsController/handlers/patch_save_answer.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { SaveAnswerSchema } from '../models';
import { AssessmentsService, ConflictError, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function saveAnswer(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const attemptId = parseInt((request.params as { attemptId: string }).attemptId, 10);
    if (isNaN(attemptId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid attempt ID' } });
    }
    const body = SaveAnswerSchema.parse(request.body);
    await service.saveAnswer(
      attemptId,
      request.user.id,
      request.user.tenant_id,
      body.question_id,
      body.answer,
    );
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: error.message } });
    }
    logger.error({ error }, 'PATCH /attempts/:attemptId/answers failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
