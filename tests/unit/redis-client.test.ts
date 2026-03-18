import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockConfig = {
  redis: {
    url: undefined as string | undefined,
    host: 'localhost',
    port: 6379,
  },
};

const mockAssertSafeRedisTarget = vi.fn();

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
};

const eventHandlers: Record<string, Array<(...args: any[]) => void>> = {};

const mockRedisClient = {
  on: vi.fn((event: string, cb: (...args: any[]) => void) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event]?.push(cb);
    return mockRedisClient;
  }),
  connect: vi.fn(async () => {
    for (const cb of eventHandlers['connect'] || []) {
      cb();
    }
  }),
  disconnect: vi.fn(async () => {
    for (const cb of eventHandlers['close'] || []) {
      cb();
    }
  }),
  set: vi.fn(async () => 'OK' as const),
  setex: vi.fn(async () => 'OK' as const),
  get: vi.fn(async () => 'cached'),
  del: vi.fn(async () => 1),
  exists: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
  ttl: vi.fn(async () => 10),
  incr: vi.fn(async () => 1),
  decr: vi.fn(async () => 0),
  hset: vi.fn(async () => 1),
  hget: vi.fn(async () => 'value'),
  hdel: vi.fn(async () => 1),
  hgetall: vi.fn(async () => ({ key: 'value' })),
  sadd: vi.fn(async () => 1),
  smembers: vi.fn(async () => ['a']),
  srem: vi.fn(async () => 1),
  lpush: vi.fn(async () => 1),
  rpush: vi.fn(async () => 1),
  lpop: vi.fn(async () => 'x'),
  rpop: vi.fn(async () => 'y'),
  llen: vi.fn(async () => 2),
  keys: vi.fn(async () => ['a']),
  flushdb: vi.fn(async () => 'OK' as const),
  ping: vi.fn(async () => 'PONG' as const),
};

const RedisCtor = vi.fn().mockImplementation(function RedisMock() {
  return mockRedisClient;
});

vi.mock('ioredis', () => ({
  default: RedisCtor,
}));

vi.mock('../../utils/config', () => ({
  config: mockConfig,
}));

vi.mock('../../utils/test-safeguards', () => ({
  assertSafeTestRedisTarget: mockAssertSafeRedisTarget,
}));

vi.mock('../../utils/logger', () => ({
  logger: mockLogger,
}));

describe('redis utility client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockConfig.redis.url = undefined;
    mockConfig.redis.host = 'localhost';
    mockConfig.redis.port = 6379;

    mockAssertSafeRedisTarget.mockReset();
    mockLogger.info.mockReset();
    mockLogger.debug.mockReset();
    mockLogger.error.mockReset();
    RedisCtor.mockClear();

    for (const key of Object.keys(eventHandlers)) {
      delete eventHandlers[key];
    }

    for (const key of Object.keys(mockRedisClient) as Array<
      keyof typeof mockRedisClient
    >) {
      const value = mockRedisClient[key];
      if (typeof value === 'function' && 'mockReset' in value) {
        (value as any).mockReset();
      }
    }

    mockRedisClient.on.mockImplementation(
      (event: string, cb: (...args: any[]) => void) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event]?.push(cb);
        return mockRedisClient;
      }
    );
    mockRedisClient.connect.mockImplementation(async () => {
      for (const cb of eventHandlers['connect'] || []) {
        cb();
      }
    });
    mockRedisClient.disconnect.mockImplementation(async () => {
      for (const cb of eventHandlers['close'] || []) {
        cb();
      }
    });
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.setex.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue('cached');
    mockRedisClient.ping.mockResolvedValue('PONG');
  });

  test('enforces redis host safeguard on construction', async () => {
    mockConfig.redis.host = 'redis';

    await import('../../utils/redis');

    expect(mockAssertSafeRedisTarget).toHaveBeenCalledWith(
      'redis',
      'Redis client'
    );
  });

  test('returns safe fallbacks while disconnected', async () => {
    const { redis } = await import('../../utils/redis');

    await expect(redis.set('k', 'v')).resolves.toBe('OK');
    await expect(redis.get('k')).resolves.toBeNull();
    await expect(redis.del('k')).resolves.toBe(0);
    await expect(redis.ping()).rejects.toThrow(/not connected/i);
  });

  test('executes redis commands after connect event', async () => {
    const { redis } = await import('../../utils/redis');

    await redis.connect();

    await expect(redis.set('k', 'v', 60)).resolves.toBe('OK');
    await expect(redis.get('k')).resolves.toBe('cached');
    await expect(redis.ping()).resolves.toBe('PONG');

    expect(mockRedisClient.setex).toHaveBeenCalledWith('k', 60, 'v');
  });

  test('throws when REDIS_URL is malformed', async () => {
    mockConfig.redis.url = '::not-a-valid-url::';

    await expect(import('../../utils/redis')).rejects.toThrow(
      /invalid REDIS_URL format/i
    );
  });
});
