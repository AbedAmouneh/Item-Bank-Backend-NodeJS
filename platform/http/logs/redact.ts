/**
 * Redact sensitive data from request/response objects
 */

import { isBlockedUrl } from '../security-patterns';

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'ssn',
  'cvv',
];

const REDACTED = '[REDACTED]';

export function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive field name
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      redacted[key] = REDACTED;
    } else if (value && typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

export function redactHeaders(
  headers: Record<string, any>
): Record<string, any> {
  const redacted = { ...headers };

  // Redact authorization header
  if (redacted['authorization']) {
    redacted['authorization'] = REDACTED;
  }

  // Redact cookie header
  if (redacted['cookie']) {
    redacted['cookie'] = REDACTED;
  }

  return redacted;
}

export function shouldLogBody(path: string): boolean {
  // Don't log bodies for file upload endpoints
  const excludePaths = ['/upload', '/import', '/export'];

  return !excludePaths.some(excluded => path.includes(excluded));
}

export function shouldLogRequest(path: string): boolean {
  const excludePaths = ['/health', '/', '/favicon.ico'];

  // Don't log if it's an excluded path
  if (excludePaths.some(excluded => path === excluded)) {
    return false;
  }

  // Don't log if it matches security filter blocked patterns
  if (isBlockedUrl(path)) {
    return false;
  }

  return true;
}

export function truncateBody(
  body: unknown,
  maxLength: number = 10000
): unknown {
  const str = JSON.stringify(body);

  if (str.length > maxLength) {
    return {
      _truncated: true,
      _originalLength: str.length,
      data: str.substring(0, maxLength),
    };
  }

  return body;
}
