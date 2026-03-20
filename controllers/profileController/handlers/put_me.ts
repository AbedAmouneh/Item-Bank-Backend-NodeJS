import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { UpdateProfileSchema, UserProfile } from '../models';
import { ProfileService } from '../service';

export const UpdateProfileRoute = '/profile/me' as const;

const logger = createChildLogger('profile-controller');
const profileService = new ProfileService();

export async function updateProfile(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const validatedData = UpdateProfileSchema.parse(request.body);

    const user = await profileService.updateProfile(
      request.user.id,
      validatedData
    );

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
    };

    return reply.status(200).send(response);
  } catch (error) {
    logger.error({ error }, 'Update profile failed');

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to update profile',
      },
    };

    return reply.status(400).send(response);
  }
}
