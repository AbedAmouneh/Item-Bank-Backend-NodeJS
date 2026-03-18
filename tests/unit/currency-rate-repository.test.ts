import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
  },
}));

describe('CurrencyRateRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  describe('getActiveRate', () => {
    test('returns active currency rate', async () => {
      const mockRate = {
        id: 1,
        currency_code: 'USD',
        rate: '1500.00',
        status: 1,
        created_on: new Date('2025-01-01'),
        updated_on: new Date('2025-01-02'),
      };

      queryMock.mockResolvedValueOnce({ rows: [mockRate] });

      const { CurrencyRateRepository } =
        await import('../../controllers/expenseController/repository/currency_rate_repository');

      const repo = new CurrencyRateRepository();
      const result = await repo.getActiveRate();

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(1500);
      expect(result?.currency_code).toBe('USD');
      expect(result?.status).toBe(1);

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = 1')
      );
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_on DESC')
      );
    });

    test('returns null when no active rate found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CurrencyRateRepository } =
        await import('../../controllers/expenseController/repository/currency_rate_repository');

      const repo = new CurrencyRateRepository();
      const result = await repo.getActiveRate();

      expect(result).toBeNull();
    });

    test('converts rate to number', async () => {
      const mockRate = {
        id: 1,
        currency_code: 'USD',
        rate: '2500.50',
        status: 1,
        created_on: new Date(),
        updated_on: new Date(),
      };

      queryMock.mockResolvedValueOnce({ rows: [mockRate] });

      const { CurrencyRateRepository } =
        await import('../../controllers/expenseController/repository/currency_rate_repository');

      const repo = new CurrencyRateRepository();
      const result = await repo.getActiveRate();

      expect(result?.rate).toBe(2500.5);
      expect(typeof result?.rate).toBe('number');
    });
  });
});
