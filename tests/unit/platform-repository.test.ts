import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: { query: queryMock },
}));

describe('PlatformRepository', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.resetModules();
  });

  describe('findTenantById', () => {
    test('uses a FILTER clause so seat_usage counts only active users', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      await repo.findTenantById(1);

      const [sql] = queryMock.mock.calls[0]!;
      expect(sql).toContain('FILTER (WHERE u.is_active = true)');
    });

    test('user_count counts all users with no active filter', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      await repo.findTenantById(1);

      const [sql] = queryMock.mock.calls[0]!;
      expect(sql).toMatch(/COUNT\(DISTINCT u\.id\)::int AS user_count/);
    });

    test('seat_usage and user_count are different expressions', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      await repo.findTenantById(1);

      const [sql] = queryMock.mock.calls[0]!;
      const seatLine = sql.match(/COUNT\(DISTINCT u\.id\)[^\n]*AS seat_usage/);
      const countLine = sql.match(/COUNT\(DISTINCT u\.id\)[^\n]*AS user_count/);
      expect(seatLine?.[0]).not.toEqual(countLine?.[0]);
    });

    test('passes the id as a query parameter', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      await repo.findTenantById(42);

      const [, params] = queryMock.mock.calls[0]!;
      expect(params).toContain(42);
    });

    test('returns null when tenant is not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      const result = await repo.findTenantById(999);

      expect(result).toBeNull();
    });

    test('returns the tenant detail row when found', async () => {
      const mockTenant = { id: 1, name: 'Acme', seat_usage: 2, user_count: 5 };
      queryMock.mockResolvedValueOnce({ rows: [mockTenant] });

      const { PlatformRepository } = await import(
        '../../controllers/platformController/repository/index'
      );
      const repo = new PlatformRepository();
      const result = await repo.findTenantById(1);

      expect(result).toEqual(mockTenant);
    });
  });
});
