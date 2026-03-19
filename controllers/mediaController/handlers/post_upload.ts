import type { MultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

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

export async function uploadMedia(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const data: MultipartFile | undefined = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No file uploaded' },
      });
    }

    if (!ALLOWED_MIME_TYPES.includes(data.mimetype as AllowedMimeType)) {
      data.file.resume();
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_MIME_TYPE',
          message:
            'Only image/jpeg, image/png, image/gif, and image/webp are allowed',
        },
      });
    }

    const buffer = await data.toBuffer();

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File size must not exceed 10MB' },
      });
    }

    const ext = MIME_TO_EXT[data.mimetype as AllowedMimeType];
    const key = `media/${uuidv4()}.${ext}`;

    await s3Service.uploadFile(config.buckets.CONTENT, key, buffer, data.mimetype);

    return reply.status(200).send({
      success: true,
      data: { url: `${config.cdn.baseUrl}/${key}` },
    });
  } catch (error) {
    logger.error({ error }, 'POST /media/upload failed');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    });
  }
}
