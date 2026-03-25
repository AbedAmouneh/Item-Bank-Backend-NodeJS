import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import {
  PostRegisterRoute,
  publicRegisterSchema,
} from '../../../types/api/account';
import { ApiResponse } from '../../../types/common';
import { toIsoString } from '../../../utils/date';
import { createChildLogger } from '../../../utils/logger';
import { AuthService } from '../service';

export { PostRegisterRoute };

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export async function register(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { full_name, email, password } = publicRegisterSchema.parse(request.body);

    // Split "Jane Smith" → first_name="Jane", last_name="Smith"
    const nameParts = full_name.trim().split(/\s+/);
    const first_name = nameParts[0] ?? '';
    const last_name = nameParts.slice(1).join(' ') || '';

    const user = await authService.register({
      email,
      password,
      role: 'user',
      first_name,
      last_name,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        is_active: user.is_active,
        created_at: toIsoString(user.created_at),
        updated_at: toIsoString(user.updated_at),
      },
      meta: {
        message: 'Account created successfully. Please log in.',
      },
    };

    return reply.status(201).send(response);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message },
      });
    }

    logger.error({ error, body: request.body }, 'Registration failed');

    const isDuplicate =
      error instanceof Error && error.message === 'Email already registered';
    const response: ApiResponse = {
      success: false,
      error: {
        code: isDuplicate ? 'EMAIL_ALREADY_EXISTS' : 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed',
      },
    };

    return reply.status(400).send(response);
  }
}
