import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { UpdateQuestionSchema } from '../models';
import { PermissionError, QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

const UpdateQuestionBodySchema = UpdateQuestionSchema.omit({ id: true });

export async function updateQuestion(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid question ID' },
      });
    }

    const body = UpdateQuestionBodySchema.parse(request.body);
    const question = await service.update(id, body, request.user.id, request.user.roles, request.user.tenant_id);

    return reply.status(200).send({ success: true, data: question });
  } catch (error) {
    logger.error({ error }, 'PUT /questions/:id failed');

    if (error instanceof PermissionError) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
