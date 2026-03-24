import { z } from 'zod';
import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { createChildLogger } from '../../../utils/logger';
import { QuestionStatus, QuestionType } from '../models';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  type: QuestionType.optional(),
  status: QuestionStatus.optional(),
  item_bank_id: z.coerce.number().int().optional(),
});

export async function exportQuestions(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = ExportQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message:
          parsed.error.issues[0]?.message ?? "format must be 'json' or 'csv'",
      },
    });
  }

  const { format, type, status, item_bank_id } = parsed.data;

  try {
    const result = await service.findAll(
      { page: 1, limit: 10000, type, status, item_bank_id },
      request.user.id,
      request.user.roles,
      request.user.tenant_id
    );

    if (format === 'csv') {
      const header = 'id,name,type,status,question_text';
      const rows = result.items.map(q => {
        const name = `"${q.name.replace(/"/g, '""')}"`;
        const text = `"${(q.text ?? '').replace(/"/g, '""')}"`;
        return `${q.id},${name},${q.type},${q.status},${text}`;
      });
      const csv = [header, ...rows].join('\n');

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="questions.csv"')
        .send(csv);
    }

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="questions.json"')
      .send(result.items);
  } catch (error) {
    logger.error({ error }, 'GET /questions/export failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
