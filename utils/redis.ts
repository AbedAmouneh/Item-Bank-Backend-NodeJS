import Redis from 'ioredis';

import { config } from './config';
import { logger } from './logger';
import { assertSafeTestRedisTarget } from './test-safeguards';

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    const baseConfig = {
      connectionName: 'app',
      lazyConnect: true,
      retryDelayOnFailover: 0,
      enableAutoPipelining: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 2000,
      commandTimeout: 2000,
    };

    const redisHost = this.resolveRedisHost();
    assertSafeTestRedisTarget(redisHost, 'Redis client');

    if (config.redis.url) {
      this.client = new Redis(config.redis.url, baseConfig);
    } else {
      this.client = new Redis({
        ...baseConfig,
        host: config.redis.host,
        port: config.redis.port,
      });
    }
    this.setupEventHandlers();
  }

  private resolveRedisHost(): string {
    if (config.redis.url) {
      try {
        const redisUrl = new URL(config.redis.url);
        return redisUrl.hostname;
      } catch (error) {
        const err = new Error(
          `Invalid REDIS_URL format: ${config.redis.url}. ${error instanceof Error ? error.message : ''}`.trim()
        );
        (err as any).cause = error;
        throw err;
      }
    }

    return config.redis.host;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('error', err => {
      this.isConnected = false;
      logger.debug(err, 'Redis connection error:');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.debug('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.debug('Redis attempting to reconnect...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error(error, 'Failed to connect to Redis:');
      throw error;
    }
  }

  /**
   * Gracefully disconnect from Redis
   * Uses quit() which waits for pending commands to complete before disconnecting
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug('Redis already disconnected, skipping');
      return;
    }

    try {
      logger.info('Disconnecting from Redis gracefully...');
      // quit() waits for pending commands to complete
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected successfully');
    } catch (error) {
      // If quit() fails, try disconnect() as fallback
      logger.warn(error, 'Graceful Redis quit failed, forcing disconnect');
      try {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis force disconnected');
      } catch (disconnectError) {
        logger.error(disconnectError, 'Error force disconnecting from Redis:');
        throw disconnectError;
      }
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    try {
      if (!this.isConnected) {
        logger.debug('Redis not connected, skipping SET operation');
        return 'OK';
      }
      if (ttlSeconds) {
        return await this.client.setex(key, ttlSeconds, value);
      }
      return await this.client.set(key, value);
    } catch (error) {
      logger.debug(error, `Redis SET error for key ${key}:`);
      return 'OK';
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected) {
        logger.debug('Redis not connected, skipping GET operation');
        return null;
      }
      return await this.client.get(key);
    } catch (error) {
      logger.debug(error, `Redis GET error for key ${key}:`);
      return null;
    }
  }

  async del(key: string): Promise<number> {
    try {
      if (!this.isConnected) {
        logger.debug('Redis not connected, skipping DEL operation');
        return 0;
      }
      return await this.client.del(key);
    } catch (error) {
      logger.debug(error, `Redis DEL error for key ${key}:`);
      return 0;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(error, `Redis EXISTS error for key ${key}:`);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(error, `Redis EXPIRE error for key ${key}:`);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(error, `Redis TTL error for key ${key}:`);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(error, `Redis INCR error for key ${key}:`);
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error(error, `Redis DECR error for key ${key}:`);
      throw error;
    }
  }

  async hset(hash: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(hash, field, value);
    } catch (error) {
      logger.error(error, `Redis HSET error for hash ${hash}, field ${field}:`);
      throw error;
    }
  }

  async hget(hash: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(hash, field);
    } catch (error) {
      logger.error(error, `Redis HGET error for hash ${hash}, field ${field}:`);
      throw error;
    }
  }

  async hdel(hash: string, field: string): Promise<number> {
    try {
      return await this.client.hdel(hash, field);
    } catch (error) {
      logger.error(error, `Redis HDEL error for hash ${hash}, field ${field}:`);
      throw error;
    }
  }

  async hgetall(hash: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(hash);
    } catch (error) {
      logger.error(error, `Redis HGETALL error for hash ${hash}:`);
      throw error;
    }
  }

  async sadd(set: string, member: string): Promise<number> {
    try {
      return await this.client.sadd(set, member);
    } catch (error) {
      logger.error(error, `Redis SADD error for set ${set}, member ${member}:`);
      throw error;
    }
  }

  async smembers(set: string): Promise<string[]> {
    try {
      return await this.client.smembers(set);
    } catch (error) {
      logger.error(error, `Redis SMEMBERS error for set ${set}:`);
      throw error;
    }
  }

  async srem(set: string, member: string): Promise<number> {
    try {
      return await this.client.srem(set, member);
    } catch (error) {
      logger.error(error, `Redis SREM error for set ${set}, member ${member}:`);
      throw error;
    }
  }

  async lpush(list: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(list, value);
    } catch (error) {
      logger.error(error, `Redis LPUSH error for list ${list}:`);
      throw error;
    }
  }

  async rpush(list: string, value: string): Promise<number> {
    try {
      return await this.client.rpush(list, value);
    } catch (error) {
      logger.error(error, `Redis RPUSH error for list ${list}:`);
      throw error;
    }
  }

  async lpop(list: string): Promise<string | null> {
    try {
      return await this.client.lpop(list);
    } catch (error) {
      logger.error(error, `Redis LPOP error for list ${list}:`);
      throw error;
    }
  }

  async rpop(list: string): Promise<string | null> {
    try {
      return await this.client.rpop(list);
    } catch (error) {
      logger.error(error, `Redis RPOP error for list ${list}:`);
      throw error;
    }
  }

  async llen(list: string): Promise<number> {
    try {
      return await this.client.llen(list);
    } catch (error) {
      logger.error(error, `Redis LLEN error for list ${list}:`);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(error, `Redis KEYS error for pattern ${pattern}:`);
      throw error;
    }
  }

  async flushdb(): Promise<'OK'> {
    try {
      return await this.client.flushdb();
    } catch (error) {
      logger.error(error, 'Redis FLUSHDB error:');
      throw error;
    }
  }

  async ping(): Promise<'PONG'> {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      return await this.client.ping();
    } catch (error) {
      logger.debug(error, 'Redis PING error:');
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getClient(): Redis {
    return this.client;
  }
}

export const redis = new RedisClient();
