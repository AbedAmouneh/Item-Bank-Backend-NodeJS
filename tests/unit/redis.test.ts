import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockInstance, mockRedisCtor } = vi.hoisted(() => {
  const instance = {
    on: vi.fn(),
    connect: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    hset: vi.fn(),
    hget: vi.fn(),
    hdel: vi.fn(),
    hgetall: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
    lpush: vi.fn(),
    rpush: vi.fn(),
    lpop: vi.fn(),
    rpop: vi.fn(),
    llen: vi.fn(),
    keys: vi.fn(),
    flushdb: vi.fn(),
    ping: vi.fn(),
  };
  // Must use `function` (not arrow) so the mock can be called with `new`
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return { mockInstance: instance, mockRedisCtor: vi.fn(function () { return instance; }) };
});

vi.mock('ioredis', () => ({ default: mockRedisCtor }));

vi.mock('../../utils/config', () => ({
  config: { redis: { host: 'localhost', port: 6379, url: undefined } },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/test-safeguards', () => ({
  assertSafeTestRedisTarget: vi.fn(),
}));

/**
 * Triggers the 'connect' event handler that setupEventHandlers() registered,
 * setting isConnected = true on the singleton under test.
 */
function simulateConnect(): void {
  const call = mockInstance.on.mock.calls.find(([event]) => event === 'connect');
  call?.[1]?.();
}

describe('RedisClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // --- constructor ---

  describe('constructor', () => {
    test('creates Redis client with host/port when no URL is configured', async () => {
      await import('../../utils/redis');

      expect(mockRedisCtor).toHaveBeenCalledOnce();
      const [arg] = mockRedisCtor.mock.calls[0] as [Record<string, unknown>];
      expect(arg).toMatchObject({ host: 'localhost', port: 6379 });
    });

    test('creates Redis client with URL when redis.url is configured', async () => {
      vi.doMock('../../utils/config', () => ({
        config: {
          redis: { host: 'localhost', port: 6379, url: 'redis://localhost:6379' },
        },
      }));

      await import('../../utils/redis');

      expect(mockRedisCtor).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.any(Object)
      );
    });
  });

  // --- event handlers ---

  describe('event handlers', () => {
    const getHandler = (event: string) =>
      mockInstance.on.mock.calls.find(([e]: [string]) => e === event)?.[1];

    test('error event sets isConnected to false', async () => {
      const { redis } = await import('../../utils/redis');

      // Simulate connect so isConnected becomes true
      simulateConnect();
      expect(redis.isHealthy()).toBe(true);

      // Trigger error event — should set isConnected = false
      const errorHandler = getHandler('error') as (err: Error) => void;
      errorHandler(new Error('connection refused'));

      expect(redis.isHealthy()).toBe(false);
    });

    test('close event sets isConnected to false', async () => {
      const { redis } = await import('../../utils/redis');

      simulateConnect();
      expect(redis.isHealthy()).toBe(true);

      const closeHandler = getHandler('close') as () => void;
      closeHandler();

      expect(redis.isHealthy()).toBe(false);
    });

    test('reconnecting event runs without throwing', async () => {
      await import('../../utils/redis');

      const reconnectingHandler = getHandler('reconnecting') as () => void;
      expect(() => reconnectingHandler()).not.toThrow();
    });
  });

  // --- connect ---

  describe('connect', () => {
    test('delegates to client.connect', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.connect.mockResolvedValueOnce(undefined);

      await redis.connect();

      expect(mockInstance.connect).toHaveBeenCalledOnce();
    });

    test('re-throws when client.connect fails', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.connect.mockRejectedValueOnce(new Error('connection refused'));

      await expect(redis.connect()).rejects.toThrow('connection refused');
    });
  });

  // --- disconnect ---

  describe('disconnect', () => {
    test('returns immediately when already disconnected', async () => {
      const { redis } = await import('../../utils/redis');

      await redis.disconnect(); // isConnected starts false

      expect(mockInstance.quit).not.toHaveBeenCalled();
    });

    test('calls quit() and marks as disconnected on success', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.quit.mockResolvedValueOnce(undefined);

      await redis.disconnect();

      expect(mockInstance.quit).toHaveBeenCalledOnce();
      expect(redis.isHealthy()).toBe(false);
    });

    test('falls back to disconnect() when quit() fails', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.quit.mockRejectedValueOnce(new Error('quit failed'));
      mockInstance.disconnect.mockResolvedValueOnce(undefined);

      await redis.disconnect();

      expect(mockInstance.disconnect).toHaveBeenCalledOnce();
      expect(redis.isHealthy()).toBe(false);
    });

    test('throws when both quit() and disconnect() fail', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.quit.mockRejectedValueOnce(new Error('quit failed'));
      mockInstance.disconnect.mockRejectedValueOnce(new Error('force failed'));

      await expect(redis.disconnect()).rejects.toThrow('force failed');
    });
  });

  // --- set ---

  describe('set', () => {
    test('returns OK without calling client when not connected', async () => {
      const { redis } = await import('../../utils/redis');

      const result = await redis.set('k', 'v');

      expect(result).toBe('OK');
      expect(mockInstance.set).not.toHaveBeenCalled();
    });

    test('calls client.set when connected without ttl', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.set.mockResolvedValueOnce('OK');

      const result = await redis.set('k', 'v');

      expect(result).toBe('OK');
      expect(mockInstance.set).toHaveBeenCalledWith('k', 'v');
    });

    test('calls client.setex when ttl is provided', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.setex.mockResolvedValueOnce('OK');

      await redis.set('k', 'v', 60);

      expect(mockInstance.setex).toHaveBeenCalledWith('k', 60, 'v');
    });

    test('returns OK silently when client.set throws', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.set.mockRejectedValueOnce(new Error('network error'));

      expect(await redis.set('k', 'v')).toBe('OK');
    });
  });

  // --- get ---

  describe('get', () => {
    test('returns null without calling client when not connected', async () => {
      const { redis } = await import('../../utils/redis');

      const result = await redis.get('k');

      expect(result).toBeNull();
      expect(mockInstance.get).not.toHaveBeenCalled();
    });

    test('returns value from client when connected', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.get.mockResolvedValueOnce('cached');

      expect(await redis.get('k')).toBe('cached');
    });

    test('returns null silently when client.get throws', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.get.mockRejectedValueOnce(new Error('network error'));

      expect(await redis.get('k')).toBeNull();
    });
  });

  // --- del ---

  describe('del', () => {
    test('returns 0 without calling client when not connected', async () => {
      const { redis } = await import('../../utils/redis');

      const result = await redis.del('k');

      expect(result).toBe(0);
      expect(mockInstance.del).not.toHaveBeenCalled();
    });

    test('returns result from client when connected', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.del.mockResolvedValueOnce(1);

      expect(await redis.del('k')).toBe(1);
    });

    test('returns 0 silently when client.del throws', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.del.mockRejectedValueOnce(new Error('network error'));

      expect(await redis.del('k')).toBe(0);
    });
  });

  // --- exists ---

  describe('exists', () => {
    test('delegates to client and returns result', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.exists.mockResolvedValueOnce(1);

      expect(await redis.exists('k')).toBe(1);
      expect(mockInstance.exists).toHaveBeenCalledWith('k');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.exists.mockRejectedValueOnce(new Error('exists failed'));

      await expect(redis.exists('k')).rejects.toThrow('exists failed');
    });
  });

  // --- expire ---

  describe('expire', () => {
    test('delegates to client with correct args', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.expire.mockResolvedValueOnce(1);

      expect(await redis.expire('k', 60)).toBe(1);
      expect(mockInstance.expire).toHaveBeenCalledWith('k', 60);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.expire.mockRejectedValueOnce(new Error('expire failed'));

      await expect(redis.expire('k', 60)).rejects.toThrow('expire failed');
    });
  });

  // --- ttl ---

  describe('ttl', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.ttl.mockResolvedValueOnce(120);

      expect(await redis.ttl('k')).toBe(120);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.ttl.mockRejectedValueOnce(new Error('ttl failed'));

      await expect(redis.ttl('k')).rejects.toThrow('ttl failed');
    });
  });

  // --- incr ---

  describe('incr', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.incr.mockResolvedValueOnce(5);

      expect(await redis.incr('counter')).toBe(5);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.incr.mockRejectedValueOnce(new Error('incr failed'));

      await expect(redis.incr('counter')).rejects.toThrow('incr failed');
    });
  });

  // --- decr ---

  describe('decr', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.decr.mockResolvedValueOnce(4);

      expect(await redis.decr('counter')).toBe(4);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.decr.mockRejectedValueOnce(new Error('decr failed'));

      await expect(redis.decr('counter')).rejects.toThrow('decr failed');
    });
  });

  // --- hash operations ---

  describe('hset', () => {
    test('delegates to client with correct args', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hset.mockResolvedValueOnce(1);

      expect(await redis.hset('hash', 'field', 'value')).toBe(1);
      expect(mockInstance.hset).toHaveBeenCalledWith('hash', 'field', 'value');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hset.mockRejectedValueOnce(new Error('hset failed'));

      await expect(redis.hset('hash', 'field', 'value')).rejects.toThrow('hset failed');
    });
  });

  describe('hget', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hget.mockResolvedValueOnce('val');

      expect(await redis.hget('hash', 'field')).toBe('val');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hget.mockRejectedValueOnce(new Error('hget failed'));

      await expect(redis.hget('hash', 'field')).rejects.toThrow('hget failed');
    });
  });

  describe('hdel', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hdel.mockResolvedValueOnce(1);

      expect(await redis.hdel('hash', 'field')).toBe(1);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hdel.mockRejectedValueOnce(new Error('hdel failed'));

      await expect(redis.hdel('hash', 'field')).rejects.toThrow('hdel failed');
    });
  });

  describe('hgetall', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hgetall.mockResolvedValueOnce({ a: '1', b: '2' });

      expect(await redis.hgetall('hash')).toEqual({ a: '1', b: '2' });
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.hgetall.mockRejectedValueOnce(new Error('hgetall failed'));

      await expect(redis.hgetall('hash')).rejects.toThrow('hgetall failed');
    });
  });

  // --- set operations ---

  describe('sadd', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.sadd.mockResolvedValueOnce(1);

      expect(await redis.sadd('myset', 'member')).toBe(1);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.sadd.mockRejectedValueOnce(new Error('sadd failed'));

      await expect(redis.sadd('myset', 'member')).rejects.toThrow('sadd failed');
    });
  });

  describe('smembers', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.smembers.mockResolvedValueOnce(['a', 'b']);

      expect(await redis.smembers('myset')).toEqual(['a', 'b']);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.smembers.mockRejectedValueOnce(new Error('smembers failed'));

      await expect(redis.smembers('myset')).rejects.toThrow('smembers failed');
    });
  });

  describe('srem', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.srem.mockResolvedValueOnce(1);

      expect(await redis.srem('myset', 'member')).toBe(1);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.srem.mockRejectedValueOnce(new Error('srem failed'));

      await expect(redis.srem('myset', 'member')).rejects.toThrow('srem failed');
    });
  });

  // --- list operations ---

  describe('lpush', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.lpush.mockResolvedValueOnce(3);

      expect(await redis.lpush('list', 'val')).toBe(3);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.lpush.mockRejectedValueOnce(new Error('lpush failed'));

      await expect(redis.lpush('list', 'val')).rejects.toThrow('lpush failed');
    });
  });

  describe('rpush', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.rpush.mockResolvedValueOnce(3);

      expect(await redis.rpush('list', 'val')).toBe(3);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.rpush.mockRejectedValueOnce(new Error('rpush failed'));

      await expect(redis.rpush('list', 'val')).rejects.toThrow('rpush failed');
    });
  });

  describe('lpop', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.lpop.mockResolvedValueOnce('item');

      expect(await redis.lpop('list')).toBe('item');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.lpop.mockRejectedValueOnce(new Error('lpop failed'));

      await expect(redis.lpop('list')).rejects.toThrow('lpop failed');
    });
  });

  describe('rpop', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.rpop.mockResolvedValueOnce('item');

      expect(await redis.rpop('list')).toBe('item');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.rpop.mockRejectedValueOnce(new Error('rpop failed'));

      await expect(redis.rpop('list')).rejects.toThrow('rpop failed');
    });
  });

  describe('llen', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.llen.mockResolvedValueOnce(5);

      expect(await redis.llen('list')).toBe(5);
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.llen.mockRejectedValueOnce(new Error('llen failed'));

      await expect(redis.llen('list')).rejects.toThrow('llen failed');
    });
  });

  // --- keys ---

  describe('keys', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.keys.mockResolvedValueOnce(['prefix:a', 'prefix:b']);

      expect(await redis.keys('prefix:*')).toEqual(['prefix:a', 'prefix:b']);
      expect(mockInstance.keys).toHaveBeenCalledWith('prefix:*');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.keys.mockRejectedValueOnce(new Error('keys failed'));

      await expect(redis.keys('prefix:*')).rejects.toThrow('keys failed');
    });
  });

  // --- flushdb ---

  describe('flushdb', () => {
    test('delegates to client', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.flushdb.mockResolvedValueOnce('OK');

      expect(await redis.flushdb()).toBe('OK');
    });

    test('re-throws on error', async () => {
      const { redis } = await import('../../utils/redis');
      mockInstance.flushdb.mockRejectedValueOnce(new Error('flushdb failed'));

      await expect(redis.flushdb()).rejects.toThrow('flushdb failed');
    });
  });

  // --- ping ---

  describe('ping', () => {
    test('throws Redis not connected when isConnected is false', async () => {
      const { redis } = await import('../../utils/redis');

      await expect(redis.ping()).rejects.toThrow('Redis not connected');
    });

    test('returns PONG when connected', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.ping.mockResolvedValueOnce('PONG');

      expect(await redis.ping()).toBe('PONG');
    });

    test('re-throws when client.ping fails', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();
      mockInstance.ping.mockRejectedValueOnce(new Error('ping failed'));

      await expect(redis.ping()).rejects.toThrow('ping failed');
    });
  });

  // --- isHealthy ---

  describe('isHealthy', () => {
    test('returns false initially', async () => {
      const { redis } = await import('../../utils/redis');

      expect(redis.isHealthy()).toBe(false);
    });

    test('returns true after connect event fires', async () => {
      const { redis } = await import('../../utils/redis');
      simulateConnect();

      expect(redis.isHealthy()).toBe(true);
    });
  });

  // --- getClient ---

  describe('getClient', () => {
    test('returns the underlying ioredis instance', async () => {
      const { redis } = await import('../../utils/redis');

      expect(redis.getClient()).toBe(mockInstance);
    });
  });
});
