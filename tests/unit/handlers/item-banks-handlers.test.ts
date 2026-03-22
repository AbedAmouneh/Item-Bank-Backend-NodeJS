import { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteItemBank } from '../../../controllers/itemBanksController/handlers/delete_item_bank';
import { getItemBank } from '../../../controllers/itemBanksController/handlers/get_item_bank';
import { getItemBanks } from '../../../controllers/itemBanksController/handlers/get_item_banks';
import { createItemBank } from '../../../controllers/itemBanksController/handlers/post_item_bank';
import { updateItemBank } from '../../../controllers/itemBanksController/handlers/put_item_bank';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

// ---------------------------------------------------------------------------
// Mock ItemBanksService + PermissionError
// ---------------------------------------------------------------------------
const { mockItemBanksService, MockPermissionError } = vi.hoisted(() => {
  class MockPermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PermissionError';
    }
  }

  return {
    mockItemBanksService: {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    MockPermissionError,
  };
});

vi.mock('../../../controllers/itemBanksController/service', () => ({
  ItemBanksService: function () {
    return mockItemBanksService;
  },
  PermissionError: MockPermissionError,
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
    user: { id: 1, email: 'user@test.local', role: 'user', is_active: true },
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

function makeItemBank(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    owner_id: 1,
    name: 'Biology Q2',
    description: null,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    question_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /item-banks
// ===========================================================================
describe('getItemBanks', () => {
  test('returns 200 with paginated list', async () => {
    const banks = [makeItemBank(), makeItemBank({ id: 2, name: 'Chemistry Q3' })];
    mockItemBanksService.findAll.mockResolvedValue({ items: banks, total: 2, page: 1, limit: 20 });

    const request = makeAuthRequest({ query: {} });
    const reply = makeReply();

    await getItemBanks(request, reply);

    expect(mockItemBanksService.findAll).toHaveBeenCalledWith(1, 'user', { page: 1, limit: 20 });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      success: true,
      data: { items: banks, total: 2, page: 1, limit: 20 },
    });
  });

  test('passes userId and role so service can scope results', async () => {
    mockItemBanksService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    const request = makeAuthRequest({
      user: { id: 7, email: 'admin@test.local', role: 'admin', is_active: true },
      query: {},
    });
    const reply = makeReply();

    await getItemBanks(request, reply);

    expect(mockItemBanksService.findAll).toHaveBeenCalledWith(7, 'admin', expect.any(Object));
  });

  test('returns 500 on service error', async () => {
    mockItemBanksService.findAll.mockRejectedValue(new Error('DB error'));

    const request = makeAuthRequest({ query: {} });
    const reply = makeReply();

    await getItemBanks(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) })
    );
  });
});

// ===========================================================================
// GET /item-banks/:id
// ===========================================================================
describe('getItemBank', () => {
  test('returns 400 for non-numeric id', async () => {
    const request = makeAuthRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await getItemBank(request, reply);

    expect(mockItemBanksService.findById).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INVALID_ID' }) })
    );
  });

  test('returns 404 when item bank does not exist', async () => {
    mockItemBanksService.findById.mockResolvedValue(null);

    const request = makeAuthRequest({ params: { id: '99' } });
    const reply = makeReply();

    await getItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) })
    );
  });

  test('returns 200 with item bank on success', async () => {
    const bank = makeItemBank();
    mockItemBanksService.findById.mockResolvedValue(bank);

    const request = makeAuthRequest({ params: { id: '1' } });
    const reply = makeReply();

    await getItemBank(request, reply);

    expect(mockItemBanksService.findById).toHaveBeenCalledWith(1, 1, 'user');
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: bank });
  });

  test('returns 500 on service error', async () => {
    mockItemBanksService.findById.mockRejectedValue(new Error('DB error'));

    const request = makeAuthRequest({ params: { id: '1' } });
    const reply = makeReply();

    await getItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ===========================================================================
// POST /item-banks
// ===========================================================================
describe('createItemBank', () => {
  test('returns 201 with created item bank', async () => {
    const bank = makeItemBank({ name: 'New Bank' });
    mockItemBanksService.create.mockResolvedValue(bank);

    const request = makeAuthRequest({ body: { name: 'New Bank' } });
    const reply = makeReply();

    await createItemBank(request, reply);

    expect(mockItemBanksService.create).toHaveBeenCalledWith({ name: 'New Bank' }, 1);
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: bank });
  });

  test('returns 201 with optional description included', async () => {
    const bank = makeItemBank({ name: 'New Bank', description: 'A description' });
    mockItemBanksService.create.mockResolvedValue(bank);

    const request = makeAuthRequest({ body: { name: 'New Bank', description: 'A description' } });
    const reply = makeReply();

    await createItemBank(request, reply);

    expect(mockItemBanksService.create).toHaveBeenCalledWith(
      { name: 'New Bank', description: 'A description' },
      1
    );
    expect(reply.status).toHaveBeenCalledWith(201);
  });

  test('returns 500 on service error', async () => {
    mockItemBanksService.create.mockRejectedValue(new Error('Duplicate name'));

    const request = makeAuthRequest({ body: { name: 'New Bank' } });
    const reply = makeReply();

    await createItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ===========================================================================
// PUT /item-banks/:id
// ===========================================================================
describe('updateItemBank', () => {
  test('returns 400 for non-numeric id', async () => {
    const request = makeAuthRequest({ params: { id: 'xyz' }, body: { name: 'Renamed' } });
    const reply = makeReply();

    await updateItemBank(request, reply);

    expect(mockItemBanksService.update).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('returns 200 with updated item bank', async () => {
    const bank = makeItemBank({ name: 'Renamed' });
    mockItemBanksService.update.mockResolvedValue(bank);

    const request = makeAuthRequest({ params: { id: '1' }, body: { name: 'Renamed' } });
    const reply = makeReply();

    await updateItemBank(request, reply);

    expect(mockItemBanksService.update).toHaveBeenCalledWith(1, { name: 'Renamed' }, 1, 'user');
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data: bank });
  });

  test('returns 403 when PermissionError is thrown', async () => {
    mockItemBanksService.update.mockRejectedValue(
      new MockPermissionError('You do not own this item bank')
    );

    const request = makeAuthRequest({ params: { id: '5' }, body: { name: 'Stolen' } });
    const reply = makeReply();

    await updateItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN', message: 'You do not own this item bank' }),
      })
    );
  });

  test('returns 500 on generic service error', async () => {
    mockItemBanksService.update.mockRejectedValue(new Error('DB error'));

    const request = makeAuthRequest({ params: { id: '1' }, body: { name: 'Renamed' } });
    const reply = makeReply();

    await updateItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});

// ===========================================================================
// DELETE /item-banks/:id
// ===========================================================================
describe('deleteItemBank', () => {
  test('returns 400 for non-numeric id', async () => {
    const request = makeAuthRequest({ params: { id: 'abc' } });
    const reply = makeReply();

    await deleteItemBank(request, reply);

    expect(mockItemBanksService.softDelete).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('returns 204 on successful soft-delete', async () => {
    mockItemBanksService.softDelete.mockResolvedValue(undefined);

    const request = makeAuthRequest({ params: { id: '1' } });
    const reply = makeReply();

    await deleteItemBank(request, reply);

    expect(mockItemBanksService.softDelete).toHaveBeenCalledWith(1, 1, 'user');
    expect(reply.status).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalledWith();
  });

  test('returns 500 on service error', async () => {
    mockItemBanksService.softDelete.mockRejectedValue(new Error('Not found'));

    const request = makeAuthRequest({ params: { id: '99' } });
    const reply = makeReply();

    await deleteItemBank(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });
});
