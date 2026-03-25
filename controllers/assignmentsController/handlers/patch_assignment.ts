import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateAssignmentSchema } from '../models';
import { AssignmentsService, NotFoundError } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function updateAssignment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user.roles.includes('teacher') && !request.user.roles.includes('org_admin')) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Teacher or admin role required' } });
  }
  try {
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid assignment ID' } });
    }
    const body = UpdateAssignmentSchema.parse(request.body);
    const assignment = await service.updateAssignment(id, body, request.user.tenant_id);
    return reply.status(200).send({ success: true, data: assignment });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    }
    logger.error({ error }, 'PATCH /assignments/:id failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
