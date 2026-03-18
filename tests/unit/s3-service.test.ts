import { beforeEach, describe, expect, test, vi } from 'vitest';

const sendMock = vi.fn();
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

describe('s3 service', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    s3ClientCtor.mockClear();
    mockAssertSafeTestS3Target.mockReset();
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
});
