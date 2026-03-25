import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { ListAssignmentsQuerySchema } from '../models';
import { AssignmentsService } from '../service';

const logger = createChildLogger('assignments-controller');
const service = new AssignmentsService();

export async function listAssignments(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const query = ListAssignmentsQuerySchema.parse(request.query);
    const result = await service.listAssignments(
      request.user.tenant_id,
      request.user.id,
      request.user.roles,
      query,
    );
    return reply.status(200).send({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message } });
    }
    logger.error({ error }, 'GET /assignments failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
