// controllers/assessmentsController/handlers/post_question_pool.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AddToPoolSchema } from '../models';
import { AssessmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function addToPool(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assessment ID' } });
    }
    const body = AddToPoolSchema.parse(request.body);
    await service.addToPool(id, body, request.user.tenant_id);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'POST /assessments/:id/pool failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
