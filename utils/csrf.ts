import crypto from 'crypto';

import { db } from '../platform/database/connection';
import { createChildLogger } from './logger';

const logger = createChildLogger('csrf');

/**
 * Generate a cryptographically secure CSRF token
 * @returns 64-character hex string (32 bytes)
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token against the session in database
 * @param accessToken - The JWT access token from the cookie
 * @param csrfToken - The CSRF token from the request header
 * @returns true if valid, false otherwise
 */
export async function validateCsrfToken(
  accessToken: string,
  csrfToken: string
): Promise<boolean> {
  try {
    const query = `
      SELECT csrf_token, csrf_created_at
      FROM user_sessions
      WHERE token = $1
        AND is_active = TRUE
        AND expires_at > NOW()
    `;

    const result = await db.query(query, [accessToken]);

    if (result.rows.length === 0) {
      logger.warn('No active session found for CSRF validation');
      return false;
    }

    const session = result.rows[0];

    // Check if CSRF token exists in session
    if (!session || !session['csrf_token']) {
      logger.warn('No CSRF token in session');
      return false;
    }

    // Validate CSRF token matches
    if (session['csrf_token'] !== csrfToken) {
      logger.warn('CSRF token mismatch');
      return false;
    }

    // Optional: Check if CSRF token is not too old (e.g., 24 hours)
    const csrfAge = Date.now() - new Date(session['csrf_created_at']).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (csrfAge > maxAge) {
      logger.warn('CSRF token expired');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Error validating CSRF token');
    return false;
  }
}

/**
 * Store CSRF token in database for a session
 * @param accessToken - The JWT access token
 * @param csrfToken - The CSRF token to store
 */
export async function storeCsrfToken(
  accessToken: string,
  csrfToken: string
): Promise<void> {
  try {
    const query = `
      UPDATE user_sessions
      SET csrf_token = $1,
          csrf_created_at = NOW()
      WHERE token = $2
        AND is_active = TRUE
    `;

    await db.query(query, [csrfToken, accessToken]);
  } catch (error) {
    logger.error({ error }, 'Error storing CSRF token');
    throw error;
  }
}
