import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: { query: queryMock },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: 10,
    game: 'quiz-arcade',
    score: 80,
    accuracy: 0.85,
    total_qs: 20,
    correct_qs: 17,
    item_bank_id: null,
    played_at: new Date(),
    ...overrides,
  };
}

describe('GameSessionsRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  describe('create', () => {
    test('inserts session and returns it with exact params', async () => {
      const session = makeSession();
      queryMock.mockResolvedValueOnce({ rows: [session] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      const result = await repo.create(
        { game: 'quiz-arcade', score: 80, accuracy: 0.85, total_qs: 20, correct_qs: 17 },
        10
      );

      expect(result).toEqual(session);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('INSERT INTO game_sessions');
      expect(call?.[0]).toContain('RETURNING *');
      expect(call?.[1]).toEqual([10, 'quiz-arcade', 80, 0.85, 20, 17, null]);
    });

    test('passes item_bank_id when provided', async () => {
      const session = makeSession({ item_bank_id: 5 });
      queryMock.mockResolvedValueOnce({ rows: [session] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      await repo.create(
        { game: 'quiz-arcade', score: 80, accuracy: 0.85, total_qs: 20, correct_qs: 17, item_bank_id: 5 },
        10
      );

      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual([10, 'quiz-arcade', 80, 0.85, 20, 17, 5]);
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();

      await expect(
        repo.create(
          { game: 'quiz-arcade', score: 0, accuracy: 0, total_qs: 0, correct_qs: 0 },
          10
        )
      ).rejects.toThrow('Failed to save game session');
    });
  });

  describe('findByUser', () => {
    test('returns paginated sessions with total count', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [makeSession({ id: 1 }), makeSession({ id: 2 })] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      const result = await repo.findByUser(10, { page: 1, limit: 20 });

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);

      const [countCall, dataCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('WHERE user_id = $1');
      expect(countCall?.[1]).toEqual([10]);
      expect(dataCall?.[0]).toContain('ORDER BY played_at DESC');
      expect(dataCall?.[1]).toEqual([10, 20, 0]); // userId, limit, offset
    });

    test('calculates correct offset for page 3', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      await repo.findByUser(10, { page: 3, limit: 5 });

      const [, dataCall] = queryMock.mock.calls;
      expect(dataCall?.[1]).toEqual([10, 5, 10]); // userId, limit=5, offset=(3-1)*5=10
    });
  });

  describe('leaderboard', () => {
    test('queries without item_bank_id filter when not provided', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      const result = await repo.leaderboard({ game: 'quiz-arcade' });

      expect(result).toEqual([]);
      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual(['quiz-arcade']);
      expect(call?.[0]).not.toContain('item_bank_id');
    });

    test('adds AND item_bank_id filter and param when provided', async () => {
      const entry = {
        rank: 1,
        user_name: 'alice@test.local',
        score: 95,
        accuracy: 0.95,
        played_at: new Date(),
      };
      queryMock.mockResolvedValueOnce({ rows: [entry] });

      const { GameSessionsRepository } = await import(
        '../../controllers/gameSessionsController/repository'
      );
      const repo = new GameSessionsRepository();
      const result = await repo.leaderboard({ game: 'quiz-arcade', item_bank_id: 3 });

      expect(result).toEqual([entry]);
      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual(['quiz-arcade', 3]);
      expect(call?.[0]).toContain('item_bank_id');
    });
  });
});
