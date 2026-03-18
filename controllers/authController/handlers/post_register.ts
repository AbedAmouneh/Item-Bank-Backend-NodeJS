import { FastifyReply, FastifyRequest } from 'fastify';

import {
  createUserRequestSchema,
  PostCreateUserRoute,
} from '../../../types/api/users';
import { ApiResponse } from '../../../types/common';
import { toIsoString } from '../../../utils/date';
import { createChildLogger } from '../../../utils/logger';
import { CreateUserRequest } from '../models';
import { AuthService } from '../service';

export { PostCreateUserRoute };

const logger = createChildLogger('auth-controller');
const authService = new AuthService();

export async function register(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const validatedData = createUserRequestSchema.parse(
      request.body
    ) as CreateUserRequest;

    const user = await authService.register(validatedData);

    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: toIsoString(user.created_at),
        updated_at: toIsoString(user.updated_at),
      },
      meta: {
        message: 'User registered successfully.',
      },
    };

    return reply.status(200).send(response);
  } catch (error) {
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
