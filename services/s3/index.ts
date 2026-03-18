import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  GetObjectCommand,
  GetObjectCommandInput,
  HeadObjectCommand,
  HeadObjectCommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';

import { CircuitBreaker } from '../../utils/circuit-breaker';
import { config } from '../../utils/config';
import { assertSafeTestS3Target } from '../../utils/test-safeguards';

export class S3Service {
  private client: S3Client;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Initialize circuit breaker for S3 operations
    this.circuitBreaker = new CircuitBreaker({
      serviceName: 'S3',
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
      requestTimeout: 30000, // 30 seconds
    });
    const clientConfig: any = {
      region: config.aws.region,
    };

    if (config.server.env === 'test') {
      const endpoint = config.testSafeguards.awsS3Endpoint;
      const forcePathStyle = config.testSafeguards.awsS3ForcePathStyle;

      assertSafeTestS3Target(endpoint, forcePathStyle, 'S3 client');

      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = forcePathStyle;
    }

    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  async uploadFile(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const params: PutObjectCommandInput = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      };

      await this.client.send(new PutObjectCommand(params));
      return `s3://${bucket}/${key}`;
    });
  }

  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    return this.circuitBreaker.execute(async () => {
      const params: GetObjectCommandInput = {
        Bucket: bucket,
        Key: key,
      };

      const response = await this.client.send(new GetObjectCommand(params));

      if (!response.Body) {
        throw new Error('No data returned from S3');
      }

      return Buffer.from(await response.Body.transformToByteArray());
    });
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      const params: DeleteObjectCommandInput = {
        Bucket: bucket,
        Key: key,
      };

      await this.client.send(new DeleteObjectCommand(params));
    });
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      try {
        const params: HeadObjectCommandInput = {
          Bucket: bucket,
          Key: key,
        };

        await this.client.send(new HeadObjectCommand(params));
        return true;
      } catch (error: any) {
        if (error.name === 'NotFound') {
          return false;
        }
        throw error;
      }
    });
  }

  async getFileMetadata(
    bucket: string,
    key: string
  ): Promise<{
    size?: number;
    lastModified?: Date;
    contentType?: string;
    metadata?: Record<string, string>;
  }> {
    return this.circuitBreaker.execute(async () => {
      const params: HeadObjectCommandInput = {
        Bucket: bucket,
        Key: key,
      };

      const response = await this.client.send(new HeadObjectCommand(params));

      return {
        ...(response.ContentLength !== undefined && {
          size: response.ContentLength,
        }),
        ...(response.LastModified !== undefined && {
          lastModified: response.LastModified,
        }),
        ...(response.ContentType !== undefined && {
          contentType: response.ContentType,
        }),
        ...(response.Metadata !== undefined && {
          metadata: response.Metadata,
        }),
      };
    });
  }

  async listFiles(
    bucket: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<
    Array<{
      key: string;
      size?: number;
      lastModified?: Date;
    }>
  > {
    return this.circuitBreaker.execute(async () => {
      const params: ListObjectsV2CommandInput = {
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      };

      const response = await this.client.send(new ListObjectsV2Command(params));

      return (response.Contents || []).map(item => ({
        key: item.Key!,
        ...(item.Size !== undefined && { size: item.Size }),
        ...(item.LastModified !== undefined && {
          lastModified: item.LastModified,
        }),
      }));
    });
  }

  async generatePresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return getSignedUrl(this.client, command, { expiresIn });
    });
  }

  /**
   * Get circuit breaker stats for monitoring
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}

export const s3Service = new S3Service();
