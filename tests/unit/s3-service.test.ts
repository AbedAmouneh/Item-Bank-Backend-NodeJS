import { beforeEach, describe, expect, test, vi } from 'vitest';

const sendMock = vi.fn();
const mockGetSignedUrl = vi.fn();
const s3ClientCtor = vi.fn().mockImplementation(function S3ClientMock(
  this: any
) {
  this.send = sendMock;
});

class PutObjectCommand {
  constructor(public input: unknown) {}
}
class GetObjectCommand {
  constructor(public input: unknown) {}
}
class DeleteObjectCommand {
  constructor(public input: unknown) {}
}
class HeadObjectCommand {
  constructor(public input: unknown) {}
}
class ListObjectsV2Command {
  constructor(public input: unknown) {}
}

const mockConfig = {
  server: { env: 'test' as 'test' | 'development' | 'production' },
  logging: { level: 'info', pretty: false },
  aws: {
    region: 'eu-west-1',
    accessKeyId: 'test',
    secretAccessKey: 'test-secret',
  },
  testSafeguards: {
    awsS3Endpoint: 'http://localhost:4566',
    awsS3ForcePathStyle: true,
  },
};

const mockAssertSafeTestS3Target = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: s3ClientCtor,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
}));

vi.mock('../../utils/config', () => ({
  config: mockConfig,
}));

vi.mock('../../utils/test-safeguards', () => ({
  assertSafeTestS3Target: mockAssertSafeTestS3Target,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

describe('s3 service', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    s3ClientCtor.mockClear();
    mockAssertSafeTestS3Target.mockReset();
    mockGetSignedUrl.mockReset();
    mockConfig.server.env = 'test';
  });

  test('uses hardcoded localstack endpoint in test mode', async () => {
    const { S3Service } = await import('../../services/s3');

    new S3Service();

    expect(mockAssertSafeTestS3Target).toHaveBeenCalledWith(
      'http://localhost:4566',
      true,
      'S3 client'
    );
    expect(s3ClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
      })
    );
  });

  test('uploads file through S3 client', async () => {
    sendMock.mockResolvedValue({});

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const uri = await service.uploadFile(
      'test-bucket',
      'folder/key.txt',
      'body'
    );

    expect(uri).toBe('s3://test-bucket/folder/key.txt');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual(
      expect.objectContaining({ Bucket: 'test-bucket', Key: 'folder/key.txt' })
    );
  });

  test('returns false on NotFound when checking file existence', async () => {
    sendMock.mockRejectedValue({ name: 'NotFound' });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    await expect(service.fileExists('bucket', 'missing')).resolves.toBe(false);
  });

  test('skips test endpoint setup when env is not test', async () => {
    mockConfig.server.env = 'development';

    const { S3Service } = await import('../../services/s3');
    new S3Service();

    expect(mockAssertSafeTestS3Target).not.toHaveBeenCalled();
    expect(s3ClientCtor).toHaveBeenCalledWith(
      expect.not.objectContaining({ endpoint: expect.anything() })
    );
  });

  test('downloadFile returns buffer from S3 body', async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    sendMock.mockResolvedValue({
      Body: { transformToByteArray: vi.fn().mockResolvedValue(bytes) },
    });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const buf = await service.downloadFile('bucket', 'hello.txt');

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf).toEqual(Buffer.from(bytes));
  });

  test('downloadFile throws when Body is missing', async () => {
    sendMock.mockResolvedValue({ Body: null });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    await expect(service.downloadFile('bucket', 'key')).rejects.toThrow(
      'No data returned from S3'
    );
  });

  test('deleteFile sends DeleteObjectCommand', async () => {
    sendMock.mockResolvedValue({});

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    await service.deleteFile('bucket', 'key.txt');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]?.[0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual(
      expect.objectContaining({ Bucket: 'bucket', Key: 'key.txt' })
    );
  });

  test('fileExists returns true when object is found', async () => {
    sendMock.mockResolvedValue({});

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    await expect(service.fileExists('bucket', 'exists.txt')).resolves.toBe(true);
  });

  test('fileExists rethrows non-NotFound errors', async () => {
    const err = Object.assign(new Error('access denied'), { name: 'Forbidden' });
    sendMock.mockRejectedValue(err);

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    await expect(service.fileExists('bucket', 'key')).rejects.toThrow(
      'access denied'
    );
  });

  test('getFileMetadata returns mapped response fields', async () => {
    const lastModified = new Date('2026-03-22T10:00:00Z');
    sendMock.mockResolvedValue({
      ContentLength: 512,
      LastModified: lastModified,
      ContentType: 'image/png',
      Metadata: { owner: 'alice' },
    });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const meta = await service.getFileMetadata('bucket', 'image.png');

    expect(meta).toEqual({
      size: 512,
      lastModified,
      contentType: 'image/png',
      metadata: { owner: 'alice' },
    });
  });

  test('listFiles maps Contents array to key/size/lastModified', async () => {
    const lastModified = new Date('2026-03-22T09:00:00Z');
    sendMock.mockResolvedValue({
      Contents: [
        { Key: 'a.txt', Size: 100, LastModified: lastModified },
        { Key: 'b.txt' },
      ],
    });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const files = await service.listFiles('bucket');

    expect(files).toEqual([
      { key: 'a.txt', size: 100, lastModified },
      { key: 'b.txt' },
    ]);
  });

  test('listFiles returns empty array when Contents is undefined', async () => {
    sendMock.mockResolvedValue({ Contents: undefined });

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const files = await service.listFiles('bucket', 'prefix/');

    expect(files).toEqual([]);
  });

  test('generatePresignedUrl calls getSignedUrl with correct args', async () => {
    mockGetSignedUrl.mockResolvedValue('https://presigned.example.com/url');

    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const url = await service.generatePresignedUrl('bucket', 'photo.jpg', 7200);

    expect(url).toBe('https://presigned.example.com/url');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(), // the S3Client instance
      expect.any(GetObjectCommand),
      { expiresIn: 7200 }
    );
  });

  test('getCircuitBreakerStats returns stats object', async () => {
    const { S3Service } = await import('../../services/s3');
    const service = new S3Service();

    const stats = service.getCircuitBreakerStats();

    expect(stats).toMatchObject({
      state: expect.any(String),
      failureCount: expect.any(Number),
      successCount: expect.any(Number),
    });
  });
});
