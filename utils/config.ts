import 'dotenv/config';

import { z } from 'zod';

import { BUCKETS, FOLDERS } from './buckets';

const TEST_SAFEGUARDS = {
  dbHostAllowlist: ['localhost', '127.0.0.1', 'postgres', 'db'],
  dbNameSuffix: '_test',
  redisHostAllowlist: ['localhost', '127.0.0.1', 'redis'],
  s3EndpointAllowlist: ['http://localhost:4566', 'http://localstack:4566'],
  awsS3Endpoint: 'http://localhost:4566',
  awsS3ForcePathStyle: true,
  allowUnsafeTestTargets: false,
} as const;

const configSchema = z.object({
  DATABASE_URL: z.string(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_POOL_MIN: z.coerce.number().default(10),
  DB_POOL_MAX: z.coerce.number().default(120),

  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PLATFORM_JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32).optional(),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),

  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('eu-west-1'),
  S3_BUCKET: z.string().optional(),
  CDN_BASE_URL: z.string().default('https://cdn.example.com'),

  DATABASE_CA_CERT: z.string().optional(),

  MOCK_DATA_DELAY: z.coerce.number().default(100),
  MOCK_DATA_FAILURE_RATE: z.coerce.number().default(0),
});

const env = configSchema.parse(process.env);

export const config = {
  database: {
    url: env.DATABASE_URL,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    caCert: env.DATABASE_CA_CERT,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
    },
  },
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  server: {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
  },
  security: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    platformJwtSecret: env.PLATFORM_JWT_SECRET,
    cookieSecret: env.COOKIE_SECRET,
    bcryptRounds: env.BCRYPT_ROUNDS,
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      window: env.RATE_LIMIT_WINDOW,
    },
  },
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: env.CORS_CREDENTIALS,
  },
  healthCheck: {
    timeout: env.HEALTH_CHECK_TIMEOUT,
  },
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
  },
  buckets: BUCKETS,
  folders: FOLDERS,
  cdn: {
    baseUrl: env.CDN_BASE_URL,
  },
  testSafeguards: TEST_SAFEGUARDS,
} as const;
