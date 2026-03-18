import crypto from 'crypto';
import { FastifyRequest } from 'fastify';

export interface DeviceFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  ipAddress: string;
  xForwardedFor?: string;
  xRealIp?: string;
}

export function generateFingerprint(request: FastifyRequest): string {
  const fingerprint: DeviceFingerprint = {
    userAgent: request.headers['user-agent'] || 'unknown',
    acceptLanguage: request.headers['accept-language'] || '',
    acceptEncoding: request.headers['accept-encoding'] || '',
    ipAddress: request.ip,
    xForwardedFor: request.headers['x-forwarded-for'] as string,
    xRealIp: request.headers['x-real-ip'] as string,
  };

  // Create a stable hash of the fingerprint components
  const fingerprintString = JSON.stringify(fingerprint);
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

export function validateFingerprint(
  currentRequest: FastifyRequest,
  storedFingerprint: string
): boolean {
  const currentFingerprint = generateFingerprint(currentRequest);
  return currentFingerprint === storedFingerprint;
}

export function createFingerprintHash(components: string[]): string {
  const combined = components.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex');
}
