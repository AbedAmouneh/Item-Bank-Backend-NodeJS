// controllers/assignmentsController/handlers/post_submission.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { SaveSubmissionSchema } from '../models';
import { AssignmentsService, ConflictError, NotFoundError } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function saveOrSubmitSubmission(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assignment ID' } });
    }
    const body = SaveSubmissionSchema.parse(request.body);
    const submission = await service.saveOrSubmit(
      id,
      request.user.id,
      request.user.tenant_id,
      body,
    );
    return reply.status(200).send({ success: true, data: submission });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: error.message } });
    }
    logger.error({ error }, 'POST /assignments/:id/submissions failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
