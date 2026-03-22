import { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock s3Service — it is a singleton, not a class, so mock the module directly.
// mockUploadFile must live inside vi.hoisted() because vi.mock() factories are
// hoisted to the top of the file and run before any const declarations.
const { mockUploadFile } = vi.hoisted(() => ({
  mockUploadFile: vi.fn(),
}));

vi.mock('../../../services/s3', () => ({
  s3Service: { uploadFile: mockUploadFile },
}));

// Mock config to control bucket name and CDN base URL.
// logging.level must be present because utils/logger.ts reads it at import time.
vi.mock('../../../utils/config', () => ({
  config: {
    buckets: { CONTENT: 'test-bucket' },
    cdn: { baseUrl: 'https://cdn.example.com' },
    logging: { level: 'silent' },
  },
}));

// Mock uuid so the generated key is deterministic in assertions
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { uploadMedia } from '../../../controllers/mediaController/handlers/post_upload';
import { uploadMediaBase64 } from '../../../controllers/mediaController/handlers/post_upload_base64';

function makeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

// Build a minimal multipart file object for the uploadMedia handler
function makeMultipartFile(overrides: {
  mimetype?: string;
  bufferSize?: number;
  resume?: () => void;
} = {}) {
  const { mimetype = 'image/jpeg', bufferSize = 100, resume = vi.fn() } = overrides;
  return {
    mimetype,
    file: { resume },
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(bufferSize)),
  };
}

describe('Media handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFile.mockResolvedValue(undefined);
  });

  // ── POST /media/upload (multipart) ──────────────────────────────────────
  describe('uploadMedia', () => {
    it('returns 400 when no file is attached', async () => {
      const request = { file: vi.fn().mockResolvedValue(undefined) } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMedia(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('returns 400 when mime type is not an allowed image type', async () => {
      const file = makeMultipartFile({ mimetype: 'application/pdf' });
      const request = { file: vi.fn().mockResolvedValue(file) } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMedia(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_MIME_TYPE' }),
        })
      );
      expect(file.file.resume).toHaveBeenCalled();
    });

    it('returns 413 when the file exceeds 10 MB', async () => {
      const tenMBPlusOne = 10 * 1024 * 1024 + 1;
      const file = makeMultipartFile({ bufferSize: tenMBPlusOne });
      const request = { file: vi.fn().mockResolvedValue(file) } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMedia(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(413);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
        })
      );
    });

    it('returns 200 with CDN URL after a successful upload', async () => {
      const file = makeMultipartFile({ mimetype: 'image/png' });
      const request = { file: vi.fn().mockResolvedValue(file) } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMedia(request as any, reply);

      expect(mockUploadFile).toHaveBeenCalledWith(
        'test-bucket',
        'media/test-uuid-1234.png',
        expect.any(Buffer),
        'image/png'
      );
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { url: 'https://cdn.example.com/media/test-uuid-1234.png' },
      });
    });

    it('returns 500 when S3 upload throws', async () => {
      mockUploadFile.mockRejectedValue(new Error('S3 unavailable'));
      const file = makeMultipartFile();
      const request = { file: vi.fn().mockResolvedValue(file) } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMedia(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  // ── POST /media/upload/base64 ───────────────────────────────────────────
  describe('uploadMediaBase64', () => {
    // A minimal 1×1 white PNG as base64 (valid image content)
    const smallBase64 = Buffer.alloc(10).toString('base64');

    it('returns 400 when mime type is not allowed', async () => {
      const request = {
        body: { data: smallBase64, mimeType: 'text/plain' },
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_MIME_TYPE' }),
        })
      );
    });

    it('returns 413 when decoded base64 exceeds 10 MB', async () => {
      // 10 MB + 1 byte of binary data encoded as base64
      const largeBase64 = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
      const request = {
        body: { data: largeBase64, mimeType: 'image/jpeg' },
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(413);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
        })
      );
    });

    it('returns 200 with CDN URL for a plain base64 string', async () => {
      const request = {
        body: { data: smallBase64, mimeType: 'image/webp' },
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      expect(mockUploadFile).toHaveBeenCalledWith(
        'test-bucket',
        'media/test-uuid-1234.webp',
        expect.any(Buffer),
        'image/webp'
      );
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { url: 'https://cdn.example.com/media/test-uuid-1234.webp' },
      });
    });

    it('strips the data URL prefix before decoding', async () => {
      const dataUrl = `data:image/gif;base64,${smallBase64}`;
      const request = {
        body: { data: dataUrl, mimeType: 'image/gif' },
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      // The handler strips "data:image/gif;base64," and still succeeds
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { url: 'https://cdn.example.com/media/test-uuid-1234.gif' },
      });
    });

    it('returns 500 when body fails Zod validation', async () => {
      const request = {
        body: { mimeType: 'image/jpeg' }, // missing required `data` field
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('returns 500 when S3 upload throws', async () => {
      mockUploadFile.mockRejectedValue(new Error('Network error'));
      const request = {
        body: { data: smallBase64, mimeType: 'image/jpeg' },
      } as unknown as FastifyRequest;
      const reply = makeReply();

      await uploadMediaBase64(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
