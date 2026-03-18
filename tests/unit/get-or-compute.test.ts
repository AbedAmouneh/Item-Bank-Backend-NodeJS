import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getOrCompute } from '../../utils/get-or-compute';

const { mockGet, mockSet, mockDebug } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('../../utils/redis', () => ({
  redis: {
    get: mockGet,
    set: mockSet,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    debug: mockDebug,
  }),
}));

describe('getOrCompute', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockDebug.mockReset();
  });

  test('returns parsed cached value when valid', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ value: 5 }));

    const compute = vi.fn().mockResolvedValue({ value: 10 });

    const result = await getOrCompute({
      key: 'k1',
      ttlSeconds: 60,
      compute,
    });

    expect(result).toEqual({ value: 5 });
    expect(compute).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('recomputes when cache JSON is invalid', async () => {
    mockGet.mockResolvedValue('not-json');
    const compute = vi.fn().mockResolvedValue({ value: 10 });

    const result = await getOrCompute({
      key: 'k2',
      ttlSeconds: 60,
      compute,
    });

    expect(result).toEqual({ value: 10 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      'k2',
      JSON.stringify({ value: 10 }),
      60
    );
  });

  test('recomputes when cached payload fails validator', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ value: 'wrong-type' }));
    const compute = vi.fn().mockResolvedValue({ value: 3 });

    const result = await getOrCompute({
      key: 'k3',
      ttlSeconds: 20,
      compute,
      isValid: (value): value is { value: number } =>
        typeof (value as { value?: unknown })?.value === 'number',
    });

    expect(result).toEqual({ value: 3 });
    expect(mockSet).toHaveBeenCalledWith(
      'k3',
      JSON.stringify({ value: 3 }),
      20
    );
    expect(mockDebug).toHaveBeenCalled();
  });

  test('computes and caches when redis returns null (cache miss)', async () => {
    mockGet.mockResolvedValue(null);
    const compute = vi.fn().mockResolvedValue([1, 2, 3]);

    const result = await getOrCompute({
      key: 'miss',
      ttlSeconds: 120,
      compute,
    });

    expect(result).toEqual([1, 2, 3]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      'miss',
      JSON.stringify([1, 2, 3]),
      120
    );
  });

  test('skips validator when isValid is not provided', async () => {
    mockGet.mockResolvedValue(JSON.stringify('any-string'));
    const compute = vi.fn();

    const result = await getOrCompute({
      key: 'no-validator',
      ttlSeconds: 10,
      compute,
    });

    expect(result).toBe('any-string');
    expect(compute).not.toHaveBeenCalled();
  });
});
