import { describe, expect, test, vi } from 'vitest';

vi.mock('../../utils/config', () => ({
  config: {
    cors: {
      origin: 'https://app.example.com',
      credentials: true,
    },
  },
}));

const { corsConfig } = await import('../../platform/http/cors');

const originValidator = corsConfig.origin as (
  origin: string | undefined,
  callback: (error: Error | null, success: boolean) => void
) => void;

function validateOrigin(origin: string | undefined): Promise<boolean> {
  return new Promise((resolve, reject) => {
    originValidator(origin, (error, success) => {
      if (error) reject(error);
      else resolve(success);
    });
  });
}

describe('CORS configuration', () => {
  test('allows requests with no origin (server-to-server)', async () => {
    const result = await validateOrigin(undefined);
    expect(result).toBe(true);
  });

  test('allows localhost origins', async () => {
    const result = await validateOrigin('http://localhost:3000');
    expect(result).toBe(true);
  });

  test('allows localhost on any port', async () => {
    const result = await validateOrigin('http://localhost:5173');
    expect(result).toBe(true);
  });

  test('allows 127.0.0.1 origins', async () => {
    const result = await validateOrigin('http://127.0.0.1:3000');
    expect(result).toBe(true);
  });

  test('allows configured CORS_ORIGIN', async () => {
    const result = await validateOrigin('https://app.example.com');
    expect(result).toBe(true);
  });

  test('rejects origins not in CORS_ORIGIN', async () => {
    await expect(validateOrigin('https://evil.com')).rejects.toThrow(
      'Not allowed by CORS'
    );
  });

  test('rejects similar-looking domains', async () => {
    await expect(validateOrigin('https://app.example.com.evil.com')).rejects.toThrow(
      'Not allowed by CORS'
    );
  });

  test('has credentials enabled', () => {
    expect(corsConfig.credentials).toBe(true);
  });

  test('allows expected HTTP methods', () => {
    expect(corsConfig.methods).toContain('GET');
    expect(corsConfig.methods).toContain('POST');
    expect(corsConfig.methods).toContain('PUT');
    expect(corsConfig.methods).toContain('DELETE');
    expect(corsConfig.methods).toContain('PATCH');
    expect(corsConfig.methods).toContain('OPTIONS');
  });

  test('includes CSRF header in allowed headers', () => {
    expect(corsConfig.allowedHeaders).toContain('X-CSRF-Token');
  });
});
