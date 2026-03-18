import pino from 'pino';

import { config } from './config';

const loggerOptions: pino.LoggerOptions = {
  level: config.logging.level,
  redact: {
    paths: ['password', 'token', 'authorization', 'secret'],
    censor: '[REDACTED]',
  },
};

if (config.logging.pretty && config.server.env === 'development') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(loggerOptions);

export const createChildLogger = (name: string): pino.Logger => {
  return logger.child({ service: name });
};
