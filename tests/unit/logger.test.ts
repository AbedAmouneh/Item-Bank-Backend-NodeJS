import { describe, expect, test } from 'vitest';

import { createChildLogger, logger } from '../../utils/logger';

describe('logger utility', () => {
  test('exports root logger instance', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('creates child logger with service binding', () => {
    const child = createChildLogger('unit-test');

    expect(typeof child.info).toBe('function');
    expect(typeof child.debug).toBe('function');
  });
});
