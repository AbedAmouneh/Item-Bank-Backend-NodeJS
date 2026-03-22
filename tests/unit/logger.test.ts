import { describe, expect, test, vi } from 'vitest';

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

  test('configures pino-pretty transport when pretty=true in development', async () => {
    vi.resetModules();

    const pinoMock = vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnValue({ info: vi.fn(), debug: vi.fn() }),
    });

    vi.doMock('../../utils/config', () => ({
      config: {
        logging: { level: 'debug', pretty: true },
        server: { env: 'development' },
      },
    }));

    vi.doMock('pino', () => ({ default: pinoMock }));

    await import('../../utils/logger');

    expect(pinoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.objectContaining({ target: 'pino-pretty' }),
      })
    );

    vi.resetModules();
  });
});
