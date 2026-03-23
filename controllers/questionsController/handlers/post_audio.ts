import fs from 'fs';
import path from 'path';
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('post-audio');

export async function uploadQuestionAudio(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { id } = request.params as { id: string };
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid question id' } });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No audio file provided' } });
    }

    const ext = path.extname(data.filename || '').replace('.', '') || 'webm';
    const filename = `${questionId}-${Date.now()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');

    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, await data.toBuffer());

    const audioUrl = `/uploads/audio/${filename}`;
    const audioName = data.filename || filename;

    await db.query(
      `UPDATE questions
       SET content = content || jsonb_build_object('audioUrl', $1::text, 'audioName', $2::text)
       WHERE id = $3`,
      [audioUrl, audioName, questionId],
    );

    return reply.status(200).send({ success: true, data: { audioUrl, audioName } });
  } catch (error) {
    logger.error({ error }, 'POST /questions/:id/audio failed');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal server error' },
    });
  }
}
