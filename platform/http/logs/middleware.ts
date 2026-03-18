import { FastifyReply, FastifyRequest } from 'fastify';

import { runtime } from '../../../utils/runtime';
import { CreateHttpLogRequest } from './models';
import {
  redactHeaders,
  redactSensitiveData,
  shouldLogBody,
  shouldLogRequest,
  truncateBody,
} from './redact';
import { HttpLogRepository } from './repository';

const httpLogRepository = new HttpLogRepository();

// Store response body temporarily
const responseBodies = new WeakMap<FastifyReply, any>();

export async function httpLoggingMiddleware(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Intercept the reply.send to capture response body
  const originalSend = reply.send.bind(reply);
  reply.send = function (payload: any) {
    responseBodies.set(reply, payload);
    return originalSend(payload);
  };
}

export async function httpLoggingOnResponse(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip logging for health checks and other excluded paths
  if (!shouldLogRequest(request.url)) {
    responseBodies.delete(reply);
    return;
  }

  const startTime = (request as any)._startTime || runtime.now().getTime();
  const duration = runtime.now().getTime() - startTime;

  // Get user ID if authenticated
  const userId = (request as any).user?.id;

  // Get client IP
  const ipAddress =
    request.ip ||
    request.headers['x-forwarded-for']?.toString().split(',')[0] ||
    request.socket.remoteAddress ||
    'unknown';

  // Parse query params
  const queryParams =
    Object.keys(request.query as object).length > 0
      ? (request.query as Record<string, any>)
      : undefined;

  // Prepare request body (redact sensitive data)
  let requestBody: any;
  if (request.body && shouldLogBody(request.url)) {
    requestBody = truncateBody(redactSensitiveData(request.body));
  }

  // Prepare response body (redact sensitive data)
  let responseBody: any;
  const payload = responseBodies.get(reply);
  if (payload && shouldLogBody(request.url)) {
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      responseBody = truncateBody(redactSensitiveData(data), 5000);
    } catch {
      // Not JSON, skip logging body
    }
  }
  // Clean up WeakMap
  responseBodies.delete(reply);

  // Prepare headers (redact sensitive ones)
  const requestHeaders = redactHeaders(request.headers as Record<string, any>);

  const logData: CreateHttpLogRequest = {
    requestId: request.id,
    method: request.method,
    path: request.url,
    responseStatus: reply.statusCode,
    durationMs: duration,
    ipAddress,
    ...(userId && { userId }),
    ...(queryParams && { queryParams }),
    ...(requestHeaders && { requestHeaders }),
    ...(requestBody ? { requestBody } : {}),
    ...(responseBody && { responseBody }),
    ...(request.headers['user-agent'] && {
      userAgent: request.headers['user-agent'],
    }),
  };

  // Fire-and-forget log creation (don't await)
  httpLogRepository.createLog(logData);
}

export async function httpErrorLoggingMiddleware(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip logging for health checks and other excluded paths
  if (!shouldLogRequest(request.url)) {
    return;
  }

  const duration = runtime.now().getTime() - (request as any)._startTime || 0;
  const userId = (request as any).user?.id;
  const ipAddress =
    request.ip ||
    request.headers['x-forwarded-for']?.toString().split(',')[0] ||
    request.socket.remoteAddress ||
    'unknown';

  const queryParams =
    Object.keys(request.query as object).length > 0
      ? (request.query as Record<string, any>)
      : undefined;

  const requestHeaders = redactHeaders(request.headers as Record<string, any>);
  const requestBody = request.body
    ? redactSensitiveData(request.body)
    : undefined;

  const logData: CreateHttpLogRequest = {
    requestId: request.id,
    method: request.method,
    path: request.url,
    responseStatus: reply.statusCode || 500,
    durationMs: duration,
    ipAddress,
    ...(userId && { userId }),
    ...(queryParams && { queryParams }),
    ...(requestHeaders && { requestHeaders }),
    ...(requestBody ? { requestBody } : {}),
    ...(request.headers['user-agent'] && {
      userAgent: request.headers['user-agent'],
    }),
    ...(error.message && { errorMessage: error.message }),
    ...(error.stack && { errorStack: error.stack }),
  };

  // Fire-and-forget log creation
  httpLogRepository.createLog(logData);
}
