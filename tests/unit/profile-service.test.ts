import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ProfileService } from '../../controllers/profileController/service';

// --- all mocks hoisted so vi.mock factories can reference them ---

const {
  mockProfileFindById,
  mockProfileUpdateEmail,
  mockProfileUpdateProfile,
  mockProfileUpdatePassword,
  mockProfileDeactivateOtherSessions,
  mockAuthFindUserById,
  mockBcryptCompare,
  mockBcryptHash,
} = vi.hoisted(() => ({
  mockProfileFindById: vi.fn(),
  mockProfileUpdateEmail: vi.fn(),
  mockProfileUpdateProfile: vi.fn(),
  mockProfileUpdatePassword: vi.fn(),
  mockProfileDeactivateOtherSessions: vi.fn(),
  mockAuthFindUserById: vi.fn(),
  mockBcryptCompare: vi.fn(),
  mockBcryptHash: vi.fn(),
}));

vi.mock('../../controllers/profileController/repository', () => ({
  ProfileRepository: function () {
    return {
      findById: mockProfileFindById,
      updateEmail: mockProfileUpdateEmail,
      updateProfile: mockProfileUpdateProfile,
      updatePassword: mockProfileUpdatePassword,
      deactivateOtherSessions: mockProfileDeactivateOtherSessions,
    };
  },
}));

vi.mock('../../controllers/authController/repository', () => ({
  AuthRepository: function () {
    return {
      findUserById: mockAuthFindUserById,
    };
  },
}));

// --- bcrypt mock ---

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

// --- config mock ---

vi.mock('../../utils/config', () => ({
  config: {
    security: {
      bcryptRounds: 10,
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'user@test.local',
    role: 'user',
    is_active: true,
    first_name: 'Alice',
    last_name: 'Test',
    username: null,
    phone_number: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfileService();
  });

  describe('getProfile', () => {
    test('returns user profile when found', async () => {
      const profile = makeProfile();
      mockProfileFindById.mockResolvedValue(profile);

      const result = await service.getProfile(1);

      expect(result).toEqual(profile);
      expect(mockProfileFindById).toHaveBeenCalledWith(1);
    });

    test('throws when user is not found', async () => {
      mockProfileFindById.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    test('calls updateEmail when email is provided', async () => {
      const updated = makeProfile({ email: 'new@test.local' });
      mockProfileUpdateEmail.mockResolvedValue(undefined);
      mockProfileFindById.mockResolvedValue(updated);

      await service.updateProfile(1, { email: 'new@test.local' });

      expect(mockProfileUpdateEmail).toHaveBeenCalledWith(1, 'new@test.local');
      expect(mockProfileUpdateProfile).not.toHaveBeenCalled();
    });

    test('calls updateProfile when name fields are provided', async () => {
      const updated = makeProfile({ first_name: 'Bob' });
      mockProfileFindById.mockResolvedValue(updated);

      await service.updateProfile(1, { first_name: 'Bob' });

      expect(mockProfileUpdateProfile).toHaveBeenCalledWith(1, {
        first_name: 'Bob',
        last_name: undefined,
        phone_number: undefined,
      });
      expect(mockProfileUpdateEmail).not.toHaveBeenCalled();
    });

    test('calls both updateEmail and updateProfile when both types of fields are provided', async () => {
      const updated = makeProfile({ email: 'new@test.local', last_name: 'Smith' });
      mockProfileUpdateEmail.mockResolvedValue(undefined);
      mockProfileFindById.mockResolvedValue(updated);

      await service.updateProfile(1, { email: 'new@test.local', last_name: 'Smith' });

      expect(mockProfileUpdateEmail).toHaveBeenCalledWith(1, 'new@test.local');
      expect(mockProfileUpdateProfile).toHaveBeenCalledWith(1, {
        first_name: undefined,
        last_name: 'Smith',
        phone_number: undefined,
      });
    });

    test('returns the re-fetched profile after updating', async () => {
      const updated = makeProfile({ first_name: 'Carol' });
      mockProfileFindById.mockResolvedValue(updated);

      const result = await service.updateProfile(1, { first_name: 'Carol' });

      expect(result).toEqual(updated);
      expect(mockProfileFindById).toHaveBeenCalledWith(1);
    });

    test('throws when user is not found after update', async () => {
      mockProfileFindById.mockResolvedValue(null);

      await expect(
        service.updateProfile(1, { first_name: 'Ghost' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    test('updates password hash and deactivates other sessions on success', async () => {
      const userRecord = { id: 1, password_hash: 'old-hash' };
      mockAuthFindUserById.mockResolvedValue(userRecord);
      mockBcryptCompare.mockResolvedValue(true);
      mockBcryptHash.mockResolvedValue('new-hash');
      mockProfileUpdatePassword.mockResolvedValue(undefined);
      mockProfileDeactivateOtherSessions.mockResolvedValue(undefined);

      await service.changePassword(1, 'old-password', 'new-password', 'current-token');

      expect(mockBcryptCompare).toHaveBeenCalledWith('old-password', 'old-hash');
      expect(mockBcryptHash).toHaveBeenCalledWith('new-password', 10);
      expect(mockProfileUpdatePassword).toHaveBeenCalledWith(1, 'new-hash');
      expect(mockProfileDeactivateOtherSessions).toHaveBeenCalledWith(1, 'current-token');
    });

    test('throws when user is not found', async () => {
      mockAuthFindUserById.mockResolvedValue(null);

      await expect(
        service.changePassword(999, 'old', 'new', 'token')
      ).rejects.toThrow('User not found');

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    test('throws when user has no password hash (e.g. OAuth account)', async () => {
      mockAuthFindUserById.mockResolvedValue({ id: 1, password_hash: null });

      await expect(
        service.changePassword(1, 'old', 'new', 'token')
      ).rejects.toThrow('Cannot change password for this account');

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    test('throws when current password does not match', async () => {
      mockAuthFindUserById.mockResolvedValue({ id: 1, password_hash: 'hash' });
      mockBcryptCompare.mockResolvedValue(false);

      await expect(
        service.changePassword(1, 'wrong-password', 'new-password', 'token')
      ).rejects.toThrow('Current password is incorrect');

      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(mockProfileUpdatePassword).not.toHaveBeenCalled();
    });
  });
});
