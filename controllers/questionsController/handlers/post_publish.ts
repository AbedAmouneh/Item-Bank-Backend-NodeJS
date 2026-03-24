import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createNotification } from '../../../platform/notifications';
import { createChildLogger } from '../../../utils/logger';
import { PublishQuestionBodySchema } from '../models';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

export async function publishQuestion(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.user.roles.includes('org_admin')) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    const id = parseInt((request.params as { id: string }).id, 10);

    if (isNaN(id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid question ID' },
      });
    }

    const body = PublishQuestionBodySchema.parse(request.body ?? {});
    const question = await service.publish(id, request.user.roles, body.reviewer_notes);

    await createNotification({
      user_id: question.owner_id,
      tenant_id: request.user.tenant_id,
      type: 'question_published',
      title: 'Your question was approved and published',
      ...(body.reviewer_notes !== undefined && { body: body.reviewer_notes }),
      entity_type: 'question',
      entity_id: question.id,
    });

    return reply.status(200).send({ success: true, data: question });
  } catch (error) {
    logger.error({ error }, 'POST /questions/:id/publish failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
