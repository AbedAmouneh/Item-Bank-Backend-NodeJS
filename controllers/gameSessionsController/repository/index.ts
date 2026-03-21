import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import {
  CreateGameSessionInput,
  GameSession,
  GameSessionListQuery,
  LeaderboardEntry,
  LeaderboardQuery,
} from '../models';

const log = createChildLogger('game-sessions-repository');

export class GameSessionsRepository {
  async create(data: CreateGameSessionInput, userId: number): Promise<GameSession> {
    const result = await db.query<GameSession>(
      `INSERT INTO game_sessions (user_id, game, score, accuracy, total_qs, correct_qs, item_bank_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        data.game,
        data.score,
        data.accuracy,
        data.total_qs,
        data.correct_qs,
        data.item_bank_id ?? null,
      ]
    );

    const session = result.rows[0];
    if (!session) throw new Error('Failed to save game session');

    log.info({ id: session.id, userId, game: data.game }, 'Game session created');
    return session;
  }

  async findByUser(
    userId: number,
    query: GameSessionListQuery
  ): Promise<{ items: GameSession[]; total: number; page: number; limit: number }> {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM game_sessions WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<GameSession>(
      `SELECT * FROM game_sessions
       WHERE user_id = $1
       ORDER BY played_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    log.debug({ userId, page, limit, total }, 'findByUser game sessions');
    return { items: dataResult.rows, total, page, limit };
  }

  async leaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const { game, item_bank_id } = query;
    const params: unknown[] = [game];
    let itemBankFilter = '';

    if (item_bank_id !== undefined) {
      params.push(item_bank_id);
      itemBankFilter = `AND gs.item_bank_id = $${params.length}`;
    }

    const result = await db.query<LeaderboardEntry>(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY gs.score DESC, gs.played_at ASC) AS rank,
         u.email AS user_name,
         gs.score,
         gs.accuracy,
         gs.played_at
       FROM game_sessions gs
       JOIN users u ON gs.user_id = u.id
       WHERE gs.game = $1 ${itemBankFilter}
       ORDER BY gs.score DESC, gs.played_at ASC
       LIMIT 10`,
      params
    );

    log.debug({ game, item_bank_id, count: result.rows.length }, 'leaderboard fetched');
    return result.rows;
  }
}
