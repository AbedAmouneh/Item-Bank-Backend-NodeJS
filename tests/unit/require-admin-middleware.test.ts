import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

function makeRequest(roles?: string[]): any {
  return roles ? { user: { id: 1, email: 'test@test.local', tenant_id: 1, roles } } : {};
}

function makeReply(): any {
  const reply: any = {};
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

describe('requireAdmin middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('sends 403 when request has no authenticated user', async () => {
    const { requireAdmin } = await import('../../platform/http/middlewares/requireAdmin');
    const req = makeRequest();
    const reply = makeReply();

    await requireAdmin(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN', message: 'Admin access required' }),
      })
    );
  });

  test('sends 403 when user does not have org_admin role', async () => {
    const { requireAdmin } = await import('../../platform/http/middlewares/requireAdmin');
    const req = makeRequest(['viewer']);
    const reply = makeReply();

    await requireAdmin(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    );
  });

  test('does not send a response when user has org_admin role', async () => {
    const { requireAdmin } = await import('../../platform/http/middlewares/requireAdmin');
    const req = makeRequest(['org_admin']);
    const reply = makeReply();

    await requireAdmin(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('does not send a response when org_admin is one of several roles', async () => {
    const { requireAdmin } = await import('../../platform/http/middlewares/requireAdmin');
    const req = makeRequest(['viewer', 'org_admin', 'editor']);
    const reply = makeReply();

    await requireAdmin(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
