import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AdminService } from '../../controllers/adminController/service';

const {
  mockFindAll,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockActivate,
  mockDeactivate,
  mockBcryptHash,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockActivate: vi.fn(),
  mockDeactivate: vi.fn(),
  mockBcryptHash: vi.fn(),
}));

vi.mock('../../controllers/adminController/repository', () => ({
  AdminRepository: function () {
    return {
      findAll: mockFindAll,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      activate: mockActivate,
      deactivate: mockDeactivate,
    };
  },
}));

vi.mock('bcryptjs', () => ({
  default: { hash: mockBcryptHash },
}));

vi.mock('../../utils/config', () => ({
  config: { security: { bcryptRounds: 10 } },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'user@test.local',
    role: 'user',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService();
  });

  describe('findAll', () => {
    test('delegates to repository and returns result', async () => {
      const expected = { items: [makeUser()], total: 1, page: 1, limit: 20 };
      mockFindAll.mockResolvedValue(expected);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(expected);
      expect(mockFindAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    test('passes filters through to repository', async () => {
      mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await service.findAll({ page: 1, limit: 20, role: 'admin', is_active: true });

      expect(mockFindAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        role: 'admin',
        is_active: true,
      });
    });
  });

  describe('findById', () => {
    test('returns user when found', async () => {
      const user = makeUser();
      mockFindById.mockResolvedValue(user);

      const result = await service.findById(1);

      expect(result).toEqual(user);
      expect(mockFindById).toHaveBeenCalledWith(1);
    });

    test('returns null when user not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('hashes the plain-text password then creates user via repository', async () => {
      const user = makeUser({ role: 'admin' });
      mockBcryptHash.mockResolvedValue('hashed-pw');
      mockCreate.mockResolvedValue(user);

      const result = await service.create({
        email: 'admin@test.local',
        password: 'plain-password',
        role: 'admin',
      });

      expect(result).toEqual(user);
      expect(mockBcryptHash).toHaveBeenCalledWith('plain-password', 10);
      expect(mockCreate).toHaveBeenCalledWith({
        email: 'admin@test.local',
        password_hash: 'hashed-pw',
        role: 'admin',
      });
    });

    test('propagates bcrypt errors', async () => {
      mockBcryptHash.mockRejectedValue(new Error('bcrypt failure'));

      await expect(
        service.create({ email: 'x@test.local', password: 'pw', role: 'user' })
      ).rejects.toThrow('bcrypt failure');

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('delegates to repository and returns result', async () => {
      const updated = makeUser({ email: 'new@test.local' });
      mockUpdate.mockResolvedValue(updated);

      const result = await service.update(1, { email: 'new@test.local' });

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(1, { email: 'new@test.local' });
    });

    test('returns null when repository returns null', async () => {
      mockUpdate.mockResolvedValue(null);

      const result = await service.update(999, {});

      expect(result).toBeNull();
    });
  });

  describe('activate', () => {
    test('delegates to repository', async () => {
      mockActivate.mockResolvedValue(undefined);

      await service.activate(1);

      expect(mockActivate).toHaveBeenCalledWith(1);
    });
  });

  describe('deactivate', () => {
    test('delegates to repository', async () => {
      mockDeactivate.mockResolvedValue(undefined);

      await service.deactivate(1);

      expect(mockDeactivate).toHaveBeenCalledWith(1);
    });
  });
});
