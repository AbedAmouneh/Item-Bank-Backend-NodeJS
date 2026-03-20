import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { ChangePasswordSchema } from '../models';
import { ProfileService } from '../service';

export const ChangePasswordRoute = '/profile/change-password' as const;

const logger = createChildLogger('profile-controller');
const profileService = new ProfileService();

export async function changePassword(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const validatedData = ChangePasswordSchema.parse(request.body);

    const currentToken = request.cookies['access_token'] ?? '';

    await profileService.changePassword(
      request.user.id,
      validatedData.current_password,
      validatedData.new_password,
      currentToken
    );

    const response: ApiResponse<null> = {
      success: true,
      data: null,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Change password failed');

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CHANGE_PASSWORD_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to change password',
      },
    };

    return reply.status(400).send(response);
  }
}
