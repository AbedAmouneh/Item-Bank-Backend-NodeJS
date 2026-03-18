import { FastifyRegisterOptions } from 'fastify';

import { config } from '../../utils/config';

export interface CorsConfig {
  origin: string[] | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

function getAllowedOrigins(): string[] | true {
  const raw = config.cors.origin;
  if (raw === '*' || raw === '') return true;
  return raw.split(',').map(o => o.trim()).filter(Boolean);
}

export const corsConfig: FastifyRegisterOptions<any> = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, success: boolean) => void
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      callback(null, true);
      return;
    }
    const allowed = getAllowedOrigins();
    if (allowed === true) {
      callback(null, true);
      return;
    }
    if (allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-CSRF-Token',
  ],
};
