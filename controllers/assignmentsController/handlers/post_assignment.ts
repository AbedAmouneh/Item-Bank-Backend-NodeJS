import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { CreateAssignmentSchema } from '../models';
import { AssignmentsService } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function createAssignment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user.roles.includes('teacher') && !request.user.roles.includes('org_admin')) {
    return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Teacher or admin role required' } });
  }
  try {
    const body = CreateAssignmentSchema.parse(request.body);
    const assignment = await service.createAssignment(body, request.user.id, request.user.tenant_id);
    return reply.status(201).send({ success: true, data: assignment });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    logger.error({ error }, 'POST /assignments failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
