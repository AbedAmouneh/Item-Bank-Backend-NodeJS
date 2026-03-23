import fs from 'fs';
import path from 'path';
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('delete-audio');

export async function deleteQuestionAudio(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid question id' } });
    }

    const result = await db.query<{ audio_url: string | null }>(
      `SELECT content->>'audioUrl' AS audio_url FROM questions WHERE id = $1`,
      [questionId],
    );

    const audioUrl = result.rows[0]?.audio_url ?? null;
    if (audioUrl) {
      const filePath = path.join(process.cwd(), audioUrl);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.error({ err }, 'Failed to delete audio file from disk');
        }
      }
    }

    await db.query(
      `UPDATE questions SET content = content - 'audioUrl' - 'audioName' WHERE id = $1`,
      [questionId],
    );

    return reply.status(200).send({ success: true });
  } catch (error) {
    logger.error({ error }, 'DELETE /questions/:id/audio failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
