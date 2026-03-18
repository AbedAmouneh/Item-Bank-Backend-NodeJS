import { describe, expect, test } from 'vitest';

import { parseFixtureName } from '../setup/scripts/fixture-utils';

describe('parseFixtureName', () => {
  test('defaults to baseline when no fixture args are provided', () => {
    expect(parseFixtureName([])).toBe('baseline');
  });

  test('reads --fixture=<name> format', () => {
    expect(parseFixtureName(['--fixture=smoke'])).toBe('smoke');
  });

  test('reads --fixture <name> format', () => {
    expect(parseFixtureName(['--fixture', 'baseline'])).toBe('baseline');
  });

  test('falls back to baseline for empty --fixture value', () => {
    expect(parseFixtureName(['--fixture='])).toBe('baseline');
    expect(parseFixtureName(['--fixture'])).toBe('baseline');
  });
});
