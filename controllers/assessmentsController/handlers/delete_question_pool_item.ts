// controllers/assessmentsController/handlers/delete_question_pool_item.ts
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { AssessmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function deletePoolItem(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const params = request.params as { id: string; questionId: string };
    const id = parseInt(params.id, 10);
    const questionId = parseInt(params.questionId, 10);
    if (isNaN(id) || isNaN(questionId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    }
    await service.removeFromPool(id, questionId, request.user.tenant_id);
    return reply.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'DELETE /assessments/:id/pool/:questionId failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
