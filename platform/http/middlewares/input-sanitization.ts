import { FastifyReply, FastifyRequest } from 'fastify';

import { createChildLogger } from '../../../utils/logger';

const logger = createChildLogger('input-sanitization');

/**
 * Input sanitization middleware
 * Sanitizes incoming request data to prevent injection attacks
 * - Trims whitespace from strings
 * - Normalizes unicode characters
 * - Removes null bytes
 * - Limits string lengths to prevent DoS
 */

const MAX_STRING_LENGTH = 10000; // Prevent extremely long strings

/**
 * Sanitize a single string value
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove null bytes (can be used for injection)
  let sanitized = value.replace(/\0/g, '');

  // Normalize unicode (prevents unicode-based attacks)
  sanitized = sanitized.normalize('NFC');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit string length to prevent DoS
  if (sanitized.length > MAX_STRING_LENGTH) {
    logger.warn(
      { originalLength: sanitized.length, maxLength: MAX_STRING_LENGTH },
      'String exceeded maximum length, truncating'
    );
    sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
  }

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    // Don't sanitize Buffer objects or special types
    if (Buffer.isBuffer(obj) || obj instanceof Date) {
      return obj;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key itself
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  // Return other types as-is (numbers, booleans, etc.)
  return obj;
}

/**
 * Input sanitization middleware for Fastify
 * Sanitizes body, query, and params
 */
export async function inputSanitization(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    // Sanitize request body
    if (request.body) {
      request.body = sanitizeObject(request.body);
    }

    // Sanitize query parameters
    if (request.query) {
      request.query = sanitizeObject(request.query);
    }

    // Sanitize route parameters
    if (request.params) {
      request.params = sanitizeObject(request.params);
    }

    // Note: We don't sanitize headers as they have their own validation
    // and sanitizing them could break authentication/CORS/etc.
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        method: request.method,
        url: request.url,
      },
      'Error during input sanitization'
    );
    // Don't block the request on sanitization errors
    // The security-filter will catch any actual attacks
  }
}
