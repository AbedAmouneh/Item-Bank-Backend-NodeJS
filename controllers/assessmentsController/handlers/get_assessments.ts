// controllers/assessmentsController/handlers/get_assessments.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ListAssessmentsQuerySchema } from '../models';
import { AssessmentsService } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function getAssessments(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = ListAssessmentsQuerySchema.parse(request.query);
    const result = await service.listAssessments(request.user.tenant_id, query);
    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    logger.error({ error }, 'GET /assessments failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
