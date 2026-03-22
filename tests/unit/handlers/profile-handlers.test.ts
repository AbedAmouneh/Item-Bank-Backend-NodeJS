import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { changePassword } from '../../../controllers/profileController/handlers/put_change_password';
import { getProfile } from '../../../controllers/profileController/handlers/get_me';
import { updateProfile } from '../../../controllers/profileController/handlers/put_me';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

// ---------------------------------------------------------------------------
// Mock ProfileService
// ---------------------------------------------------------------------------
const { mockProfileService } = vi.hoisted(() => ({
  mockProfileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock('../../../controllers/profileController/service', () => ({
  ProfileService: function () {
    return mockProfileService;
  },
}));

vi.mock('../../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAuthRequest(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    user: { id: 5, email: 'me@test.local', role: 'user', is_active: true },
    body: {},
    query: {},
    params: {},
    cookies: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
}

function makeUserProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    email: 'me@test.local',
    role: 'user' as const,
    is_active: true,
    first_name: 'Abed',
    last_name: 'Smith',
    username: null,
    phone_number: null,
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /profile/me
// ===========================================================================
describe('getProfile', () => {
  test('returns 200 with the current user profile', async () => {
    const profile = makeUserProfile();
    mockProfileService.getProfile.mockResolvedValue(profile);

    const request = makeAuthRequest();
    const reply = makeReply();

    await getProfile(request, reply);

    expect(mockProfileService.getProfile).toHaveBeenCalledWith(5);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: profile });
  });

  test('returns 400 (not 500) when service throws', async () => {
    mockProfileService.getProfile.mockRejectedValue(new Error('User not found'));

    const request = makeAuthRequest();
    const reply = makeReply();

    await getProfile(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'PROFILE_ERROR', message: 'User not found' }),
      })
    );
  });
});

// ===========================================================================
// PUT /profile/me
// ===========================================================================
describe('updateProfile', () => {
  test('returns 200 with updated profile on success', async () => {
    const profile = makeUserProfile({ first_name: 'Ahmed', phone_number: '+1234567890' });
    mockProfileService.updateProfile.mockResolvedValue(profile);

    const request = makeAuthRequest({
      body: { first_name: 'Ahmed', phone_number: '+1234567890' },
    });
    const reply = makeReply();

    await updateProfile(request, reply);

    expect(mockProfileService.updateProfile).toHaveBeenCalledWith(5, {
      first_name: 'Ahmed',
      phone_number: '+1234567890',
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: profile });
  });

  test('returns 200 with a partial update (only email)', async () => {
    const profile = makeUserProfile({ email: 'new@test.local' });
    mockProfileService.updateProfile.mockResolvedValue(profile);

    const request = makeAuthRequest({ body: { email: 'new@test.local' } });
    const reply = makeReply();

    await updateProfile(request, reply);

    expect(mockProfileService.updateProfile).toHaveBeenCalledWith(5, {
      email: 'new@test.local',
    });
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  test('returns 400 (not 500) when service throws', async () => {
    mockProfileService.updateProfile.mockRejectedValue(new Error('Email already in use'));

    const request = makeAuthRequest({ body: { email: 'taken@test.local' } });
    const reply = makeReply();

    await updateProfile(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'UPDATE_PROFILE_ERROR',
          message: 'Email already in use',
        }),
      })
    );
  });
});

// ===========================================================================
// PUT /profile/change-password
// ===========================================================================
describe('changePassword', () => {
  test('returns 200 on successful password change', async () => {
    mockProfileService.changePassword.mockResolvedValue(undefined);

    const request = makeAuthRequest({
      body: {
        current_password: 'OldPass1!',
        new_password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      },
      cookies: { access_token: 'jwt.token.here' },
    });
    const reply = makeReply();

    await changePassword(request, reply);

    // Passes the current access token so the service can invalidate it
    expect(mockProfileService.changePassword).toHaveBeenCalledWith(
      5,
      'OldPass1!',
      'NewPass1!',
      'jwt.token.here'
    );
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: null });
  });

  test('passes empty string when no access_token cookie is present', async () => {
    mockProfileService.changePassword.mockResolvedValue(undefined);

    const request = makeAuthRequest({
      body: {
        current_password: 'OldPass1!',
        new_password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      },
      cookies: {},
    });
    const reply = makeReply();

    await changePassword(request, reply);

    expect(mockProfileService.changePassword).toHaveBeenCalledWith(
      5,
      'OldPass1!',
      'NewPass1!',
      '' // falls back to empty string
    );
  });

  test('returns 400 when Zod rejects mismatched passwords', async () => {
    const request = makeAuthRequest({
      body: {
        current_password: 'OldPass1!',
        new_password: 'NewPass1!',
        confirm_password: 'DifferentPass1!',
      },
      cookies: {},
    });
    const reply = makeReply();

    await changePassword(request, reply);

    expect(mockProfileService.changePassword).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test('returns 400 (not 500) when service throws (e.g. wrong current password)', async () => {
    mockProfileService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

    const request = makeAuthRequest({
      body: {
        current_password: 'WrongPass1!',
        new_password: 'NewPass1!',
        confirm_password: 'NewPass1!',
      },
      cookies: { access_token: 'jwt.token.here' },
    });
    const reply = makeReply();

    await changePassword(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'CHANGE_PASSWORD_ERROR',
          message: 'Current password is incorrect',
        }),
      })
    );
  });
});
