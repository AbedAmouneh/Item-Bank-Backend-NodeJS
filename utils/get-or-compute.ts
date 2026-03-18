import { createChildLogger } from './logger';
import { redis } from './redis';

const logger = createChildLogger('get-or-compute');

interface GetOrComputeOptions<T> {
  key: string;
  ttlSeconds: number;
  compute: () => Promise<T>;
  isValid?: (value: unknown) => value is T;
}

export async function getOrCompute<T>(
  options: GetOrComputeOptions<T>
): Promise<T> {
  const { key, ttlSeconds, compute, isValid } = options;

  const cached = await redis.get(key);
  if (cached !== null) {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (!isValid || isValid(parsed)) {
        return parsed as T;
      }
      logger.debug({ key }, 'Invalid cached payload, recomputing');
    } catch (error) {
      logger.debug({ key, error }, 'Failed to parse cached payload');
    }
  }

  const computed = await compute();
  await redis.set(key, JSON.stringify(computed), ttlSeconds);
  return computed;
}
