import crypto from 'crypto';

import { config } from './config';

export interface Runtime {
  now: () => Date;
  nowIso: () => string;
  newId: () => string;
  isTest: () => boolean;
}

export const runtime: Runtime = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
  isTest: () => config.server.env === 'test',
};
