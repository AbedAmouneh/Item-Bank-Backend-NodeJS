import bcrypt from 'bcryptjs';

import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import { AuthRepository } from '../../authController/repository';
import { UpdateProfileData, UserProfile } from '../models';
import { ProfileRepository } from '../repository';

const logger = createChildLogger('profile-service');

export class ProfileService {
  private profileRepository: ProfileRepository;
  private authRepository: AuthRepository;

  constructor() {
    this.profileRepository = new ProfileRepository();
    this.authRepository = new AuthRepository();
  }

  async getProfile(userId: number): Promise<UserProfile> {
    const user = await this.profileRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: number,
    data: UpdateProfileData
  ): Promise<UserProfile> {
    if (data.email) {
      await this.profileRepository.updateEmail(userId, data.email);
      logger.info({ userId, email: data.email }, 'Profile email updated');
    }

    if (data.first_name !== undefined || data.last_name !== undefined || data.phone_number !== undefined) {
      await this.profileRepository.updateProfile(userId, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
      });
      logger.info({ userId }, 'Profile fields updated');
    }

    const updated = await this.profileRepository.findById(userId);
    if (!updated) {
      throw new Error('User not found');
    }
    return updated;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    currentToken: string
  ): Promise<void> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userRecord = user as unknown as { password_hash: string | null };
    if (!userRecord.password_hash) {
      throw new Error('Cannot change password for this account');
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      userRecord.password_hash
    );
    if (!isValid) {
      logger.warn({ userId }, 'Change password failed: incorrect current password');
      throw new Error('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    await this.profileRepository.updatePassword(userId, newHash);
    await this.profileRepository.deactivateOtherSessions(userId, currentToken);

    logger.info({ userId }, 'Password changed and other sessions deactivated');
  }
}
