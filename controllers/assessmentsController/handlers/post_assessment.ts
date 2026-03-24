// controllers/assessmentsController/handlers/post_assessment.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateAssessmentSchema } from '../models';
import { AssessmentsService } from '../service';

const logger = createChildLogger('assessments-controller');
const service = new AssessmentsService();

export async function createAssessment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const body = CreateAssessmentSchema.parse(request.body);
    const assessment = await service.createAssessment(body, request.user.id, request.user.tenant_id);
    return reply.status(201).send({ success: true, data: assessment });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    logger.error({ error }, 'POST /assessments failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
