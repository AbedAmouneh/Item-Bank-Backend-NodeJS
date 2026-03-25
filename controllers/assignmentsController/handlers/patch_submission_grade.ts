// controllers/assignmentsController/handlers/patch_submission_grade.ts
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { GradeSubmissionSchema } from '../models';
import { AssignmentsService, ConflictError, NotFoundError } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function gradeSubmission(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user.roles.includes('teacher') && !request.user.roles.includes('org_admin')) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Teacher or admin role required' } });
  }
  try {
    const { id, subId } = request.params as { id: string; subId: string };
    const assignmentId = parseInt(id, 10);
    const submissionId = parseInt(subId, 10);
    if (isNaN(assignmentId) || isNaN(submissionId)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    }
    const body = GradeSubmissionSchema.parse(request.body);
    const submission = await service.gradeSubmission(
      submissionId,
      assignmentId,
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
    logger.error({ error }, 'PATCH /assignments/:id/submissions/:subId/grade failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
