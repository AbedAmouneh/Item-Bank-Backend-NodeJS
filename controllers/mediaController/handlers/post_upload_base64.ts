import { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { s3Service } from '../../../services/s3';
import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('media-controller');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const UploadBase64Schema = z.object({
  data: z.string(),
  mimeType: z.string(),
});

export async function uploadMediaBase64(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = UploadBase64Schema.parse(request.body);

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType as AllowedMimeType)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_MIME_TYPE',
          message:
            'Only image/jpeg, image/png, image/gif, and image/webp are allowed',
        },
      });
    }

    // Strip the data URL prefix if present (e.g. "data:image/png;base64,")
    const base64Data = body.data.includes(',')
      ? (body.data.split(',')[1] ?? body.data)
      : body.data;

    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File size must not exceed 10MB' },
      });
    }

    const ext = MIME_TO_EXT[body.mimeType as AllowedMimeType];
    const key = `media/${uuidv4()}.${ext}`;

    await s3Service.uploadFile(config.buckets.CONTENT, key, buffer, body.mimeType);

    return reply.status(200).send({
      success: true,
      data: { url: `${config.cdn.baseUrl}/${key}` },
    });
  } catch (error) {
    logger.error({ error }, 'POST /media/upload/base64 failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
