import { config } from './config';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
  if (config.redis.url) {
    const url = new URL(config.redis.url);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      ...(url.password && { password: url.password }),
    };
  }

  return {
    host: config.redis.host,
    port: config.redis.port,
    ...(config.redis.password && { password: config.redis.password }),
  };
}
