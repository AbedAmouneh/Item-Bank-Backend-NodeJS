import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { ProfileService } from '../service';
import { UserProfile } from '../models';

export const GetProfileRoute = '/profile/me' as const;

const logger = createChildLogger('profile-controller');
const profileService = new ProfileService();

export async function getProfile(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = await profileService.getProfile(request.user.id);

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Get profile failed');

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PROFILE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get profile',
      },
    };

    return reply.status(400).send(response);
  }
}
