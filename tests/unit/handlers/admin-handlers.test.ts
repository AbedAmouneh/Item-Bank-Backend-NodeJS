import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { activateUser } from '../../../controllers/adminController/handlers/post_activate_user';
import { deactivateUser } from '../../../controllers/adminController/handlers/post_deactivate_user';
import { createUser } from '../../../controllers/adminController/handlers/post_user';
import { updateUser } from '../../../controllers/adminController/handlers/put_user';
import { getUser } from '../../../controllers/adminController/handlers/get_user';
import { getUsers } from '../../../controllers/adminController/handlers/get_users';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

// ---------------------------------------------------------------------------
// Mock AdminService — all handler files share one singleton, but vi.mock
// replaces the constructor so every `new AdminService()` returns our stub.
// ---------------------------------------------------------------------------
const { mockAdminService } = vi.hoisted(() => ({
  mockAdminService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

vi.mock('../../../controllers/adminController/service', () => ({
  AdminService: function () {
    return mockAdminService;
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
function makeAdminRequest(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    user: { id: 1, email: 'admin@test.local', role: 'admin', is_active: true },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeUserRequest(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return makeAdminRequest({
    user: { id: 2, email: 'user@test.local', role: 'user', is_active: true },
    ...overrides,
  });
}

function makeReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
}

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    email: 'target@test.local',
    role: 'user' as const,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /admin/users
// ===========================================================================
describe('getUsers', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ query: {} });
    const reply = makeReply();

    await getUsers(request, reply);

    expect(mockAdminService.findAll).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    );
  });

  test('returns 200 with paginated user list', async () => {
    const users = [makeAdminUser(), makeAdminUser({ id: 11, email: 'b@test.local' })];
    mockAdminService.findAll.mockResolvedValue({ items: users, total: 2, page: 1, limit: 20 });

    const request = makeAdminRequest({ query: {} });
    const reply = makeReply();

    await getUsers(request, reply);

    expect(mockAdminService.findAll).toHaveBeenCalledOnce();
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      success: true,
      data: { items: users, total: 2, page: 1, limit: 20 },
    });
  });

  test('returns 500 on service error', async () => {
    mockAdminService.findAll.mockRejectedValue(new Error('DB error'));

    const request = makeAdminRequest({ query: {} });
    const reply = makeReply();

    await getUsers(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) })
    );
  });
});

// ===========================================================================
// GET /admin/users/:id
// ===========================================================================
describe('getUser', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ params: { id: '10' } });
    const reply = makeReply();

    await getUser(request, reply);

    expect(mockAdminService.findById).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const request = makeAdminRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await getUser(request, reply);

    expect(mockAdminService.findById).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INVALID_ID' }) })
    );
  });

  test('returns 404 when user does not exist', async () => {
    mockAdminService.findById.mockResolvedValue(null);

    const request = makeAdminRequest({ params: { id: '99' } });
    const reply = makeReply();

    await getUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) })
    );
  });

  test('returns 200 with user data on success', async () => {
    const user = makeAdminUser();
    mockAdminService.findById.mockResolvedValue(user);

    const request = makeAdminRequest({ params: { id: '10' } });
    const reply = makeReply();

    await getUser(request, reply);

    expect(mockAdminService.findById).toHaveBeenCalledWith(10);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: user });
  });

  test('returns 500 on service error', async () => {
    mockAdminService.findById.mockRejectedValue(new Error('DB error'));

    const request = makeAdminRequest({ params: { id: '10' } });
    const reply = makeReply();

    await getUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ===========================================================================
// POST /admin/users
// ===========================================================================
describe('createUser', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ body: { email: 'new@test.local', password: 'secret123', role: 'user' } });
    const reply = makeReply();

    await createUser(request, reply);

    expect(mockAdminService.create).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  test('returns 201 with created user', async () => {
    const user = makeAdminUser({ email: 'new@test.local' });
    mockAdminService.create.mockResolvedValue(user);

    const request = makeAdminRequest({
      body: { email: 'new@test.local', password: 'secret123', role: 'user' },
    });
    const reply = makeReply();

    await createUser(request, reply);

    expect(mockAdminService.create).toHaveBeenCalledWith({
      email: 'new@test.local',
      password: 'secret123',
      role: 'user',
    });
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: user });
  });

  test('returns 400 (not 500) when service throws', async () => {
    mockAdminService.create.mockRejectedValue(new Error('Email already in use'));

    const request = makeAdminRequest({
      body: { email: 'existing@test.local', password: 'secret123', role: 'user' },
    });
    const reply = makeReply();

    await createUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CREATE_USER_ERROR', message: 'Email already in use' }),
      })
    );
  });
});

// ===========================================================================
// PUT /admin/users/:id
// ===========================================================================
describe('updateUser', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ params: { id: '10' }, body: { role: 'admin' } });
    const reply = makeReply();

    await updateUser(request, reply);

    expect(mockAdminService.update).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const request = makeAdminRequest({ params: { id: 'xyz' }, body: { role: 'admin' } });
    const reply = makeReply();

    await updateUser(request, reply);

    expect(mockAdminService.update).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INVALID_ID' }) })
    );
  });

  test('returns 404 when user does not exist', async () => {
    mockAdminService.update.mockResolvedValue(null);

    const request = makeAdminRequest({ params: { id: '99' }, body: { role: 'admin' } });
    const reply = makeReply();

    await updateUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) })
    );
  });

  test('returns 200 with updated user', async () => {
    const user = makeAdminUser({ role: 'admin' });
    mockAdminService.update.mockResolvedValue(user);

    const request = makeAdminRequest({ params: { id: '10' }, body: { role: 'admin' } });
    const reply = makeReply();

    await updateUser(request, reply);

    expect(mockAdminService.update).toHaveBeenCalledWith(10, { role: 'admin' });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: user });
  });

  test('returns 400 (not 500) when service throws', async () => {
    mockAdminService.update.mockRejectedValue(new Error('Email already taken'));

    const request = makeAdminRequest({ params: { id: '10' }, body: { email: 'taken@test.local' } });
    const reply = makeReply();

    await updateUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UPDATE_USER_ERROR' }),
      })
    );
  });
});

// ===========================================================================
// POST /admin/users/:id/activate
// ===========================================================================
describe('activateUser', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ params: { id: '10' } });
    const reply = makeReply();

    await activateUser(request, reply);

    expect(mockAdminService.activate).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const request = makeAdminRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await activateUser(request, reply);

    expect(mockAdminService.activate).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('returns 200 on success', async () => {
    mockAdminService.activate.mockResolvedValue(undefined);

    const request = makeAdminRequest({ params: { id: '10' } });
    const reply = makeReply();

    await activateUser(request, reply);

    expect(mockAdminService.activate).toHaveBeenCalledWith(10);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: null });
  });

  test('returns 400 (not 500) when service throws (e.g. user not found)', async () => {
    mockAdminService.activate.mockRejectedValue(new Error('User not found'));

    const request = makeAdminRequest({ params: { id: '99' } });
    const reply = makeReply();

    await activateUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ACTIVATE_USER_ERROR', message: 'User not found' }),
      })
    );
  });
});

// ===========================================================================
// POST /admin/users/:id/deactivate
// ===========================================================================
describe('deactivateUser', () => {
  test('returns 403 for non-admin', async () => {
    const request = makeUserRequest({ params: { id: '10' } });
    const reply = makeReply();

    await deactivateUser(request, reply);

    expect(mockAdminService.deactivate).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const request = makeAdminRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await deactivateUser(request, reply);

    expect(mockAdminService.deactivate).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('returns 200 on success', async () => {
    mockAdminService.deactivate.mockResolvedValue(undefined);

    const request = makeAdminRequest({ params: { id: '10' } });
    const reply = makeReply();

    await deactivateUser(request, reply);

    expect(mockAdminService.deactivate).toHaveBeenCalledWith(10);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: null });
  });

  test('returns 400 (not 500) when service throws (e.g. user already inactive)', async () => {
    mockAdminService.deactivate.mockRejectedValue(new Error('User already inactive'));

    const request = makeAdminRequest({ params: { id: '10' } });
    const reply = makeReply();

    await deactivateUser(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'DEACTIVATE_USER_ERROR', message: 'User already inactive' }),
      })
    );
  });
});
