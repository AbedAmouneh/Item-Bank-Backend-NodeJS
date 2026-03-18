import { describe, expect, test } from 'vitest';

import { BUCKETS, FOLDERS } from '../../utils/buckets';
import { normalizeCurrencyAmount } from '../../utils/currency';
import { toIsoString } from '../../utils/date';
import {
  createFingerprintHash,
  generateFingerprint,
  validateFingerprint,
} from '../../utils/fingerprint';

describe('core utility modules', () => {
  // --- buckets ---

  test('exports expected bucket and folder constants', () => {
    expect(BUCKETS.CONTENT).toBe('vox-content');
    expect(BUCKETS.BACKUPS).toBe('vox-backups');
    expect(FOLDERS.IMAGES).toBe('images');
    expect(FOLDERS.OTHER).toBe('other');
  });

  test('exports TEMP bucket and all folder names', () => {
    expect(BUCKETS.TEMP).toBe('vox-temp');
    expect(FOLDERS.DOCUMENTS).toBe('documents');
    expect(FOLDERS.AUDIO).toBe('audio');
    expect(FOLDERS.VIDEO).toBe('video');
  });

  // --- currency ---

  test('normalizes USD amounts', () => {
    const result = normalizeCurrencyAmount(12.5, 'USD', 90000);

    expect(result).toEqual({
      amountUsd: 12.5,
      amountLbp: 1125000,
      rate: 90000,
    });
  });

  test('normalizes LBP amounts', () => {
    const result = normalizeCurrencyAmount(900000, 'LBP', 90000);

    expect(result).toEqual({
      amountUsd: 10,
      amountLbp: 900000,
      rate: 90000,
    });
  });

  test('rejects invalid currency inputs', () => {
    expect(() => normalizeCurrencyAmount(0, 'USD', 90000)).toThrow(
      /greater than zero/i
    );
    expect(() => normalizeCurrencyAmount(10, 'USD', 0)).toThrow(
      /positive number/i
    );
  });

  test('accepts string rate input and coerces to number', () => {
    const result = normalizeCurrencyAmount(10, 'USD', '90000' as any);

    expect(result.rate).toBe(90000);
    expect(result.amountLbp).toBe(900000);
  });

  test('rejects NaN and negative rate values', () => {
    expect(() => normalizeCurrencyAmount(10, 'USD', NaN)).toThrow(
      /positive number/i
    );
    expect(() => normalizeCurrencyAmount(10, 'USD', -1)).toThrow(
      /positive number/i
    );
    expect(() => normalizeCurrencyAmount(10, 'USD', 'abc' as any)).toThrow(
      /positive number/i
    );
  });

  test('rounds results to two decimal places', () => {
    // 1 USD / 3 = 0.333... should become 0.33
    const result = normalizeCurrencyAmount(1, 'LBP', 3);
    expect(result.amountUsd).toBeCloseTo(0.33, 2);
  });

  // --- date ---

  test('converts Date and string values to ISO strings', () => {
    const date = new Date('2026-01-28T12:30:00.000Z');

    expect(toIsoString(date)).toBe('2026-01-28T12:30:00.000Z');
    expect(toIsoString('2026-01-28')).toBe('2026-01-28T00:00:00.000Z');
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString('not-a-date')).toBeNull();
  });

  test('returns null for undefined date input', () => {
    expect(toIsoString(undefined)).toBeNull();
  });

  test('returns null for empty string date input', () => {
    expect(toIsoString('')).toBeNull();
  });

  test('converts ISO datetime strings correctly', () => {
    expect(toIsoString('2026-06-15T08:00:00Z')).toBe(
      '2026-06-15T08:00:00.000Z'
    );
  });

  // --- fingerprint ---

  test('generates stable request fingerprints and validates them', () => {
    const request = {
      headers: {
        'user-agent': 'Vitest-Agent',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip',
      },
      ip: '127.0.0.1',
    } as any;

    const fingerprint = generateFingerprint(request);

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(validateFingerprint(request, fingerprint)).toBe(true);
  });

  test('creates deterministic hashes from arbitrary components', () => {
    const a = createFingerprintHash(['a', 'b', 'c']);
    const b = createFingerprintHash(['a', 'b', 'c']);
    const c = createFingerprintHash(['a', 'b', 'd']);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test('uses "unknown" for missing user-agent header', () => {
    const request = {
      headers: {},
      ip: '10.0.0.1',
    } as any;

    const fingerprint = generateFingerprint(request);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('returns false when fingerprint does not match', () => {
    const request = {
      headers: { 'user-agent': 'A' },
      ip: '1.2.3.4',
    } as any;

    expect(validateFingerprint(request, 'bad-fingerprint')).toBe(false);
  });

  test('produces different fingerprints for different IPs', () => {
    const base = { headers: { 'user-agent': 'X' } };
    const a = generateFingerprint({ ...base, ip: '1.1.1.1' } as any);
    const b = generateFingerprint({ ...base, ip: '2.2.2.2' } as any);

    expect(a).not.toBe(b);
  });

  test('includes proxy headers in fingerprint', () => {
    const base = {
      headers: {
        'user-agent': 'X',
        'x-forwarded-for': '10.0.0.1',
        'x-real-ip': '10.0.0.2',
      },
      ip: '1.1.1.1',
    } as any;
    const withoutProxy = {
      headers: { 'user-agent': 'X' },
      ip: '1.1.1.1',
    } as any;

    expect(generateFingerprint(base)).not.toBe(
      generateFingerprint(withoutProxy)
    );
  });

  test('creates different hashes for empty and single-element arrays', () => {
    const empty = createFingerprintHash([]);
    const single = createFingerprintHash(['a']);

    expect(empty).not.toBe(single);
    expect(empty).toMatch(/^[a-f0-9]{64}$/);
  });
});
