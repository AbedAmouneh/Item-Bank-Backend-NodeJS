import { describe, expect, test } from 'vitest';

import { runtime } from '../../utils/runtime';

describe('runtime utility', () => {
  test('provides current time helpers', () => {
    const now = runtime.now();
    expect(now).toBeInstanceOf(Date);

    const iso = runtime.nowIso();
    expect(typeof iso).toBe('string');
    expect(new Date(iso).toString()).not.toBe('Invalid Date');
  });

  test('generates ids and exposes test mode', () => {
    const id1 = runtime.newId();
    const id2 = runtime.newId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
    expect(typeof runtime.isTest()).toBe('boolean');
  });

  test('isTest returns true in test environment', () => {
    expect(runtime.isTest()).toBe(true);
  });

  test('newId produces valid UUID format', () => {
    const id = runtime.newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('nowIso returns a recent timestamp', () => {
    const before = Date.now();
    const iso = runtime.nowIso();
    const after = Date.now();
    const ts = new Date(iso).getTime();

    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
