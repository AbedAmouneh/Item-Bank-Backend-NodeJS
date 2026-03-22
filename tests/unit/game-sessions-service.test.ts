import { beforeEach, describe, expect, test, vi } from 'vitest';

import { GameSessionsService } from '../../controllers/gameSessionsController/service';

const { mockFindByUser, mockCreate, mockLeaderboard } = vi.hoisted(() => ({
  mockFindByUser: vi.fn(),
  mockCreate: vi.fn(),
  mockLeaderboard: vi.fn(),
}));

vi.mock('../../controllers/gameSessionsController/repository', () => ({
  GameSessionsRepository: function () {
    return {
      create: mockCreate,
      findByUser: mockFindByUser,
      leaderboard: mockLeaderboard,
    };
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

describe('GameSessionsService', () => {
  let service: GameSessionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GameSessionsService();
  });

  // --- create ---

  describe('create', () => {
    test('delegates to repository and returns created session', async () => {
      const session = makeSession();
      mockCreate.mockResolvedValue(session);

      const result = await service.create(
        { game: 'quiz-arcade', score: 80, accuracy: 0.85, total_qs: 20, correct_qs: 17 },
        10
      );

      expect(result).toEqual(session);
      expect(mockCreate).toHaveBeenCalledWith(
        { game: 'quiz-arcade', score: 80, accuracy: 0.85, total_qs: 20, correct_qs: 17 },
        10
      );
    });

    test('propagates repository errors', async () => {
      mockCreate.mockRejectedValue(new Error('Failed to save game session'));

      await expect(
        service.create({ game: 'quiz-arcade', score: 0, accuracy: 0, total_qs: 0, correct_qs: 0 }, 10)
      ).rejects.toThrow('Failed to save game session');
    });
  });

  // --- findByUser ---

  describe('findByUser', () => {
    test('delegates to repository and returns paginated result', async () => {
      const expected = {
        items: [makeSession({ id: 1 }), makeSession({ id: 2 })],
        total: 2,
        page: 1,
        limit: 20,
      };
      mockFindByUser.mockResolvedValue(expected);

      const result = await service.findByUser(10, { page: 1, limit: 20 });

      expect(result).toEqual(expected);
      expect(mockFindByUser).toHaveBeenCalledWith(10, { page: 1, limit: 20 });
    });
  });

  // --- leaderboard ---

  describe('leaderboard', () => {
    test('delegates to repository and returns entries', async () => {
      const entry = {
        rank: 1,
        user_name: 'alice@test.local',
        score: 95,
        accuracy: 0.95,
        played_at: new Date(),
      };
      mockLeaderboard.mockResolvedValue([entry]);

      const result = await service.leaderboard({ game: 'quiz-arcade' });

      expect(result).toEqual([entry]);
      expect(mockLeaderboard).toHaveBeenCalledWith({ game: 'quiz-arcade' });
    });

    test('passes item_bank_id filter through to repository', async () => {
      mockLeaderboard.mockResolvedValue([]);

      await service.leaderboard({ game: 'quiz-arcade', item_bank_id: 3 });

      expect(mockLeaderboard).toHaveBeenCalledWith({ game: 'quiz-arcade', item_bank_id: 3 });
    });
  });
});
