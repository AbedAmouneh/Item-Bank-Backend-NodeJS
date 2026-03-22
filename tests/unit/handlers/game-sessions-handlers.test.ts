import { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGameSessionsService } = vi.hoisted(() => ({
  mockGameSessionsService: {
    findByUser: vi.fn(),
    leaderboard: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../../controllers/gameSessionsController/service', () => ({
  GameSessionsService: function () {
    return mockGameSessionsService;
  },
}));

import { getGameSessions } from '../../../controllers/gameSessionsController/handlers/get_game_sessions';
import { getLeaderboard } from '../../../controllers/gameSessionsController/handlers/get_leaderboard';
import { createGameSession } from '../../../controllers/gameSessionsController/handlers/post_game_session';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function makeAuthRequest(overrides: DeepPartial<FastifyRequest> = {}): FastifyRequest {
  return {
    user: { id: 5 },
    query: {},
    body: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

function makeRequest(overrides: DeepPartial<FastifyRequest> = {}): FastifyRequest {
  return {
    query: {},
    body: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe('GameSessions handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /game-sessions ──────────────────────────────────────────────────
  describe('getGameSessions', () => {
    it('returns 200 with paginated sessions for the authenticated user', async () => {
      const sessions = [{ id: 1, game: 'quiz-arcade', score: 800 }];
      mockGameSessionsService.findByUser.mockResolvedValue(sessions);

      const request = makeAuthRequest({ query: { page: '1', limit: '10' } });
      const reply = makeReply();

      await getGameSessions(request as any, reply);

      expect(mockGameSessionsService.findByUser).toHaveBeenCalledWith(5, {
        page: 1,
        limit: 10,
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: sessions });
    });

    it('returns 200 with defaults when no query params are provided', async () => {
      mockGameSessionsService.findByUser.mockResolvedValue([]);

      const request = makeAuthRequest({ query: {} });
      const reply = makeReply();

      await getGameSessions(request as any, reply);

      expect(mockGameSessionsService.findByUser).toHaveBeenCalledWith(5, {
        page: 1,
        limit: 20,
      });
      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 when service throws', async () => {
      mockGameSessionsService.findByUser.mockRejectedValue(new Error('DB error'));

      const request = makeAuthRequest();
      const reply = makeReply();

      await getGameSessions(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  // ── GET /leaderboard ────────────────────────────────────────────────────
  describe('getLeaderboard', () => {
    it('returns 200 with leaderboard data', async () => {
      const entries = [{ rank: 1, user_name: 'alice', score: 1000 }];
      mockGameSessionsService.leaderboard.mockResolvedValue(entries);

      const request = makeRequest({ query: { game: 'quiz-arcade' } });
      const reply = makeReply();

      await getLeaderboard(request, reply);

      expect(mockGameSessionsService.leaderboard).toHaveBeenCalledWith({
        game: 'quiz-arcade',
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: entries });
    });

    it('returns 500 when an invalid game type is supplied', async () => {
      const request = makeRequest({ query: { game: 'not-a-real-game' } });
      const reply = makeReply();

      await getLeaderboard(request, reply);

      // Zod rejects the enum value — handler catches and returns 500
      expect(reply.status).toHaveBeenCalledWith(500);
      expect(mockGameSessionsService.leaderboard).not.toHaveBeenCalled();
    });

    it('returns 500 when service throws', async () => {
      mockGameSessionsService.leaderboard.mockRejectedValue(new Error('DB error'));

      const request = makeRequest({ query: { game: 'memory-match' } });
      const reply = makeReply();

      await getLeaderboard(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  // ── POST /game-sessions ─────────────────────────────────────────────────
  describe('createGameSession', () => {
    const validBody = {
      game: 'quiz-arcade',
      score: 750,
      accuracy: 85.5,
      total_qs: 20,
      correct_qs: 17,
    };

    it('returns 201 with the created session', async () => {
      const created = { id: 42, user_id: 5, ...validBody };
      mockGameSessionsService.create.mockResolvedValue(created);

      const request = makeAuthRequest({ body: validBody });
      const reply = makeReply();

      await createGameSession(request as any, reply);

      expect(mockGameSessionsService.create).toHaveBeenCalledWith(validBody, 5);
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: created });
    });

    it('returns 201 with optional item_bank_id when provided', async () => {
      const bodyWithBank = { ...validBody, item_bank_id: 3 };
      const created = { id: 43, user_id: 5, ...bodyWithBank };
      mockGameSessionsService.create.mockResolvedValue(created);

      const request = makeAuthRequest({ body: bodyWithBank });
      const reply = makeReply();

      await createGameSession(request as any, reply);

      expect(mockGameSessionsService.create).toHaveBeenCalledWith(bodyWithBank, 5);
      expect(reply.status).toHaveBeenCalledWith(201);
    });

    it('returns 500 when body fails Zod validation', async () => {
      const request = makeAuthRequest({ body: { game: 'invalid-game' } });
      const reply = makeReply();

      await createGameSession(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(mockGameSessionsService.create).not.toHaveBeenCalled();
    });

    it('returns 500 when service throws', async () => {
      mockGameSessionsService.create.mockRejectedValue(new Error('Insert failed'));

      const request = makeAuthRequest({ body: validBody });
      const reply = makeReply();

      await createGameSession(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });
});
