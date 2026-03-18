import { describe, expect, test } from 'vitest';

import {
  redactHeaders,
  redactSensitiveData,
  shouldLogBody,
  shouldLogRequest,
  truncateBody,
} from '../../platform/http/logs/redact';

describe('redactSensitiveData', () => {
  test('returns primitives unchanged', () => {
    expect(redactSensitiveData(null)).toBe(null);
    expect(redactSensitiveData(undefined)).toBe(undefined);
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData('hello')).toBe('hello');
  });

  test('redacts password fields', () => {
    const result = redactSensitiveData({ password: 'secret123' });
    expect(result).toEqual({ password: '[REDACTED]' });
  });

  test('redacts token fields', () => {
    const result = redactSensitiveData({
      accessToken: 'abc',
      refreshToken: 'xyz',
    });
    expect(result).toEqual({
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
    });
  });

  test('redacts authorization and cookie fields', () => {
    const result = redactSensitiveData({
      authorization: 'Bearer abc',
      cookie: 'session=abc',
    });
    expect(result).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
    });
  });

  test('redacts fields containing sensitive keywords (case-insensitive)', () => {
    const result = redactSensitiveData({
      myApiKey: 'key123',
      userSecret: 'secret',
      creditCardNumber: '4111111111111111',
      ssnValue: '123-45-6789',
      cvvCode: '123',
    });
    expect(result).toEqual({
      myApiKey: '[REDACTED]',
      userSecret: '[REDACTED]',
      creditCardNumber: '[REDACTED]',
      ssnValue: '[REDACTED]',
      cvvCode: '[REDACTED]',
    });
  });

  test('preserves non-sensitive fields', () => {
    const result = redactSensitiveData({
      email: 'admin@test.local',
      role: 'admin',
      id: 42,
    });
    expect(result).toEqual({ email: 'admin@test.local', role: 'admin', id: 42 });
  });

  test('handles nested objects', () => {
    const result = redactSensitiveData({
      user: { name: 'Ali', password: 'pass' },
    }) as any;
    expect(result.user.name).toBe('Ali');
    expect(result.user.password).toBe('[REDACTED]');
  });

  test('handles arrays', () => {
    const result = redactSensitiveData([
      { password: 'a' },
      { name: 'b' },
    ]) as any[];
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].name).toBe('b');
  });
});

describe('redactHeaders', () => {
  test('redacts authorization header', () => {
    const result = redactHeaders({ authorization: 'Bearer token123' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  test('redacts cookie header', () => {
    const result = redactHeaders({ cookie: 'session=abc' });
    expect(result.cookie).toBe('[REDACTED]');
  });

  test('preserves other headers', () => {
    const result = redactHeaders({
      'content-type': 'application/json',
      'x-request-id': '123',
    });
    expect(result['content-type']).toBe('application/json');
    expect(result['x-request-id']).toBe('123');
  });

  test('does not modify original object', () => {
    const original = { authorization: 'Bearer abc', host: 'example.com' };
    redactHeaders(original);
    expect(original.authorization).toBe('Bearer abc');
  });
});

describe('shouldLogBody', () => {
  test('returns true for regular API paths', () => {
    expect(shouldLogBody('/api/items')).toBe(true);
    expect(shouldLogBody('/api/auth/login')).toBe(true);
  });

  test('returns false for upload paths', () => {
    expect(shouldLogBody('/api/upload')).toBe(false);
  });

  test('returns false for import paths', () => {
    expect(shouldLogBody('/api/items/import')).toBe(false);
  });

  test('returns false for export paths', () => {
    expect(shouldLogBody('/api/items/export')).toBe(false);
  });
});

describe('shouldLogRequest', () => {
  test('returns true for API paths', () => {
    expect(shouldLogRequest('/api/items')).toBe(true);
    expect(shouldLogRequest('/api/auth/login')).toBe(true);
  });

  test('returns false for health check', () => {
    expect(shouldLogRequest('/health')).toBe(false);
  });

  test('returns false for root path', () => {
    expect(shouldLogRequest('/')).toBe(false);
  });

  test('returns false for favicon', () => {
    expect(shouldLogRequest('/favicon.ico')).toBe(false);
  });

  test('returns false for blocked security URLs', () => {
    expect(shouldLogRequest('/wp-admin/')).toBe(false);
    expect(shouldLogRequest('/.env')).toBe(false);
  });
});

describe('truncateBody', () => {
  test('returns body unchanged when under limit', () => {
    const body = { name: 'Ali' };
    expect(truncateBody(body)).toEqual(body);
  });

  test('truncates body exceeding default limit', () => {
    const body = { data: 'x'.repeat(15000) };
    const result = truncateBody(body) as any;
    expect(result._truncated).toBe(true);
    expect(result._originalLength).toBeGreaterThan(10000);
    expect(result.data.length).toBe(10000);
  });

  test('respects custom max length', () => {
    const body = { data: 'x'.repeat(200) };
    const result = truncateBody(body, 50) as any;
    expect(result._truncated).toBe(true);
    expect(result.data.length).toBe(50);
  });

  test('does not truncate when exactly at limit', () => {
    const body = { a: 1 };
    const len = JSON.stringify(body).length;
    expect(truncateBody(body, len)).toEqual(body);
  });
});
