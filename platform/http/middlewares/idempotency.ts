import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';
import { redis } from '../../../utils/redis';

const logger = createChildLogger('idempotency');

/**
 * Idempotency middleware for preventing duplicate requests
 *
 * Uses idempotency keys to detect and prevent duplicate operations.
 * Stores response in Redis for a short period (24 hours) and returns
 * the cached response if the same idempotency key is used again.
 *
 * Usage:
 * - Client sends `Idempotency-Key` header with unique identifier
 * - If key already exists, returns cached response
 * - If key is new, processes request and caches response
 *
 * Critical for operations like:
 * - Vote submissions
 * - Financial transactions
 * - Data imports
 */

interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: string;
}

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

/**
 * Check if this is an idempotent operation that should be cached
 */
function isIdempotentOperation(request: FastifyRequest): boolean {
  // Only apply to state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return false;
  }

  // Check if client provided idempotency key
  const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];
  return !!idempotencyKey;
}

/**
 * Generate Redis key for idempotency
 */
function getRedisKey(
  userId: number | string | undefined,
  idempotencyKey: string,
  route: string
): string {
  // Include userId and route in key to scope idempotency per user and endpoint
  const userPart = userId || 'anonymous';
  const routePart = route.replace(/\//g, ':');
  return `${IDEMPOTENCY_KEY_PREFIX}${userPart}:${routePart}:${idempotencyKey}`;
}

/**
 * Idempotency middleware
 */
export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip if not an idempotent operation
  if (!isIdempotentOperation(request)) {
    return;
  }

  const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as string;
  const userId = (request as any).user?.id;
  const route = request.routeOptions?.url || request.url;

  const redisKey = getRedisKey(userId, idempotencyKey, route);

  try {
    // Check if we've seen this idempotency key before
    const cached = await redis.get(redisKey);

    if (cached) {
      const cachedResponse: CachedResponse = JSON.parse(cached);

      logger.info(
        {
          idempotencyKey,
          userId,
          route,
          cachedTimestamp: cachedResponse.timestamp,
          requestId: request.id,
        },
        'Duplicate request detected, returning cached response'
      );

      // Return cached response with special header
      reply.header('X-Idempotency-Replayed', 'true');
      reply.header(
        'X-Idempotency-Original-Timestamp',
        cachedResponse.timestamp
      );
      reply.status(cachedResponse.statusCode).send(cachedResponse.body);
      return;
    }

    // Mark this as a new idempotent request
    // We'll cache the response in the onResponse hook
    (request as any).idempotencyKey = idempotencyKey;
    (request as any).idempotencyRedisKey = redisKey;

    logger.debug(
      {
        idempotencyKey,
        userId,
        route,
        requestId: request.id,
      },
      'New idempotent request'
    );
  } catch (error) {
    // Don't block the request if Redis fails
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        idempotencyKey,
        userId,
        route,
        requestId: request.id,
      },
      'Failed to check idempotency key, processing request anyway'
    );
  }
}

/**
 * Response hook to cache successful idempotent responses
 * onSend hook signature: (request, reply, payload, done)
 */
export async function cacheIdempotentResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: any
): Promise<any> {
  const idempotencyKey = (request as any).idempotencyKey;
  const redisKey = (request as any).idempotencyRedisKey;

  // Skip if not an idempotent request or if request failed
  if (!idempotencyKey || !redisKey || reply.statusCode >= 400) {
    return payload;
  }

  try {
    if (!payload) {
      logger.debug(
        { idempotencyKey, requestId: request.id },
        'No response body to cache'
      );
      return payload;
    }

    // Parse payload if it's a string (JSON)
    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        // Keep as string if not JSON
      }
    }

    const cachedResponse: CachedResponse = {
      statusCode: reply.statusCode,
      body: parsedPayload,
      timestamp: new Date().toISOString(),
    };

    // Cache the response (don't await to not block the response)
    redis
      .set(redisKey, JSON.stringify(cachedResponse), IDEMPOTENCY_TTL_SECONDS)
      .then(() => {
        logger.debug(
          {
            idempotencyKey,
            statusCode: reply.statusCode,
            ttl: IDEMPOTENCY_TTL_SECONDS,
            requestId: request.id,
          },
          'Cached idempotent response'
        );
      })
      .catch(error => {
        logger.error(
          {
            error: error instanceof Error ? error.message : error,
            idempotencyKey,
            requestId: request.id,
          },
          'Failed to cache idempotent response'
        );
      });
  } catch (error) {
    // Don't fail the request if caching fails
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        idempotencyKey,
        requestId: request.id,
      },
      'Failed to process idempotent response'
    );
  }

  return payload;
}

/**
 * Manually invalidate an idempotency key (for admin use)
 */
export async function invalidateIdempotencyKey(
  userId: number | string,
  route: string,
  idempotencyKey: string
): Promise<boolean> {
  try {
    const redisKey = getRedisKey(userId, idempotencyKey, route);
    const result = await redis.del(redisKey);
    return result > 0;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        userId,
        route,
        idempotencyKey,
      },
      'Failed to invalidate idempotency key'
    );
    return false;
  }
}
