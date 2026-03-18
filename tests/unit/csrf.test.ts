import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  generateCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
} from '../../utils/csrf';

const { mockQuery, mockWarn, mockError } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: mockQuery,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    warn: mockWarn,
    error: mockError,
  }),
}));

describe('csrf utilities', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockWarn.mockReset();
    mockError.mockReset();
  });

  // --- generateCsrfToken ---

  test('generates 64-char hex token', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  test('generates unique tokens on successive calls', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });

  // --- validateCsrfToken ---

  test('returns false when no active session exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await expect(validateCsrfToken('access', 'csrf')).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('No active session')
    );
  });

  test('returns false when session has no csrf_token', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ csrf_token: null, csrf_created_at: new Date().toISOString() }],
    });

    await expect(validateCsrfToken('access', 'csrf')).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('No CSRF token in session')
    );
  });

  test('returns false when csrf token mismatches', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { csrf_token: 'expected', csrf_created_at: new Date().toISOString() },
      ],
    });

    await expect(validateCsrfToken('access', 'actual')).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('mismatch'));
  });

  test('returns false when csrf token is expired (>24h)', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          csrf_token: 'expected',
          csrf_created_at: new Date(
            Date.now() - 25 * 60 * 60 * 1000
          ).toISOString(),
        },
      ],
    });

    await expect(validateCsrfToken('access', 'expected')).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('expired'));
  });

  test('returns true for valid csrf token', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { csrf_token: 'expected', csrf_created_at: new Date().toISOString() },
      ],
    });

    await expect(validateCsrfToken('access', 'expected')).resolves.toBe(true);
  });

  test('returns false and logs error when db query throws', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));

    await expect(validateCsrfToken('access', 'csrf')).resolves.toBe(false);
    expect(mockError).toHaveBeenCalled();
  });

  // --- storeCsrfToken ---

  test('stores csrf token in session', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });

    await storeCsrfToken('access', 'new-token');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_sessions'),
      ['new-token', 'access']
    );
  });

  test('propagates db error from storeCsrfToken', async () => {
    mockQuery.mockRejectedValue(new Error('write failed'));

    await expect(storeCsrfToken('access', 'tok')).rejects.toThrow(
      'write failed'
    );
    expect(mockError).toHaveBeenCalled();
  });
});
