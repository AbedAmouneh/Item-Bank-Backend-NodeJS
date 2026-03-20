import { z } from 'zod';
import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { exportToExcel } from '../../../utils/export/excel';
import { exportToPDF } from '../../../utils/export/pdf';
import { createChildLogger } from '../../../utils/logger';
import { QuestionStatus, QuestionType } from '../models';
import { QuestionsService } from '../service';

const logger = createChildLogger('questions-controller');
const service = new QuestionsService();

const ExportQuerySchema = z.object({
  format: z.enum(['xlsx', 'pdf']),
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
          parsed.error.issues[0]?.message ??
          "format is required and must be 'xlsx' or 'pdf'",
      },
    });
  }

  const { format, type, status, item_bank_id } = parsed.data;

  try {
    const result = await service.findAll(
      { page: 1, limit: 10000, type, status, item_bank_id },
      request.user.id,
      request.user.role
    );

    const rows = result.items.map(q => ({
      id: q.id,
      name: q.name,
      type: q.type,
      status: q.status,
      mark: q.mark,
      item_bank: q.item_bank_id ?? '',
      tags: (q.tags ?? []).map(t => t.name).join('; '),
      created_at:
        q.created_at instanceof Date
          ? q.created_at.toISOString()
          : String(q.created_at),
    }));

    if (format === 'xlsx') {
      const buffer = await exportToExcel(rows, { sheetName: 'Questions' });
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        .header('Content-Disposition', 'attachment; filename="questions.xlsx"')
        .send(buffer);
    } else {
      const buffer = await exportToPDF(rows, {
        title: 'Questions',
        orientation: 'landscape',
      });
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="questions.pdf"')
        .send(buffer);
    }
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
