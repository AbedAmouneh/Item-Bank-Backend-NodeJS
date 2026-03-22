import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteTag } from '../../../controllers/tagsController/handlers/delete_tag';
import { getTags } from '../../../controllers/tagsController/handlers/get_tags';
import { createTag } from '../../../controllers/tagsController/handlers/post_tag';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

// ---------------------------------------------------------------------------
// Mock the TagsService so no real DB calls are made.
// vi.hoisted() ensures the mock object is created before any imports run.
// ---------------------------------------------------------------------------
const { mockTagsService } = vi.hoisted(() => ({
  mockTagsService: {
    findAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../controllers/tagsController/service', () => ({
  TagsService: function () {
    return mockTagsService;
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
// Helpers — build minimal request / reply objects that satisfy TypeScript
// ---------------------------------------------------------------------------
function makeAuthRequest(overrides: Record<string, unknown> = {}): AuthenticatedRequest {
  return {
    user: {
      id: 1,
      email: 'admin@test.local',
      role: 'admin',
      is_active: true,
    },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function makeReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
}

function makeTag(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Mathematics',
    slug: 'mathematics',
    created_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset all mocks before each test so calls don't bleed across tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /tags
// ===========================================================================
describe('getTags', () => {
  test('returns 200 with paginated tag list on success', async () => {
    const tags = [makeTag(), makeTag({ id: 2, name: 'Science', slug: 'science' })];
    mockTagsService.findAll.mockResolvedValue({
      items: tags,
      total: 2,
      page: 1,
      limit: 50,
    });

    const request = makeAuthRequest({ query: {} });
    const reply = makeReply();

    await getTags(request, reply);

    expect(mockTagsService.findAll).toHaveBeenCalledOnce();
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      success: true,
      data: { items: tags, total: 2, page: 1, limit: 50 },
    });
  });

  test('returns 200 with custom page and limit from query string', async () => {
    mockTagsService.findAll.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
    });

    const request = makeAuthRequest({ query: { page: '2', limit: '10' } });
    const reply = makeReply();

    await getTags(request, reply);

    expect(mockTagsService.findAll).toHaveBeenCalledWith({ page: 2, limit: 10 });
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  test('returns 500 when service throws', async () => {
    mockTagsService.findAll.mockRejectedValue(new Error('DB connection lost'));

    const request = makeAuthRequest();
    const reply = makeReply();

    await getTags(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

// ===========================================================================
// POST /tags
// ===========================================================================
describe('createTag', () => {
  test('returns 403 when called by a non-admin user', async () => {
    const request = makeAuthRequest({
      user: { id: 2, email: 'user@test.local', role: 'user', is_active: true },
      body: { name: 'Mathematics', slug: 'mathematics' },
    });
    const reply = makeReply();

    await createTag(request, reply);

    expect(mockTagsService.create).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    );
  });

  test('returns 201 with new tag when admin provides valid body', async () => {
    const tag = makeTag();
    mockTagsService.create.mockResolvedValue(tag);

    const request = makeAuthRequest({
      body: { name: 'Mathematics', slug: 'mathematics' },
    });
    const reply = makeReply();

    await createTag(request, reply);

    expect(mockTagsService.create).toHaveBeenCalledWith({
      name: 'Mathematics',
      slug: 'mathematics',
    });
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: tag });
  });

  test('returns 500 when service throws', async () => {
    mockTagsService.create.mockRejectedValue(new Error('A tag with this slug already exists'));

    const request = makeAuthRequest({
      body: { name: 'Mathematics', slug: 'mathematics' },
    });
    const reply = makeReply();

    await createTag(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'A tag with this slug already exists' }),
      })
    );
  });
});

// ===========================================================================
// DELETE /tags/:id
// ===========================================================================
describe('deleteTag', () => {
  test('returns 403 when called by a non-admin user', async () => {
    const request = makeAuthRequest({
      user: { id: 2, email: 'user@test.local', role: 'user', is_active: true },
      params: { id: '1' },
    });
    const reply = makeReply();

    await deleteTag(request, reply);

    expect(mockTagsService.delete).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    );
  });

  test('returns 400 when :id is not a valid integer', async () => {
    const request = makeAuthRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await deleteTag(request, reply);

    expect(mockTagsService.delete).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_ID' }),
      })
    );
  });

  test('returns 204 when admin deletes an existing tag', async () => {
    mockTagsService.delete.mockResolvedValue(undefined);

    const request = makeAuthRequest({ params: { id: '1' } });
    const reply = makeReply();

    await deleteTag(request, reply);

    expect(mockTagsService.delete).toHaveBeenCalledWith(1);
    expect(reply.status).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalledWith();
  });

  test('returns 500 when service throws (e.g. tag not found)', async () => {
    mockTagsService.delete.mockRejectedValue(new Error('Tag not found'));

    const request = makeAuthRequest({ params: { id: '99' } });
    const reply = makeReply();

    await deleteTag(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Tag not found' }),
      })
    );
  });
});
