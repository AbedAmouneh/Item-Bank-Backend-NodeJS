import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import { AnalyticsOverview } from '../models';

const log = createChildLogger('analytics-repository');

export class AnalyticsRepository {
  async getOverview(tenantId: number): Promise<AnalyticsOverview> {
    log.info('getOverview');

    const [
      statusResult,
      typeResult,
      totalQsResult,
      totalGsResult,
      gsGameResult,
      uniquePlayersResult,
      topPlayersResult,
    ] = await Promise.all([
      // Question counts grouped by status
      db.query<{ status: string; count: number }>(
        'SELECT status, COUNT(*)::int AS count FROM questions WHERE tenant_id = $1 GROUP BY status',
        [tenantId]
      ),
      // Question counts grouped by type
      db.query<{ type: string; count: number }>(
        'SELECT type, COUNT(*)::int AS count FROM questions WHERE tenant_id = $1 GROUP BY type ORDER BY count DESC',
        [tenantId]
      ),
      // Total questions
      db.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM questions WHERE tenant_id = $1',
        [tenantId]
      ),
      // Total game sessions
      db.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM game_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)',
        [tenantId]
      ),
      // Sessions per game, ordered by count descending (first row = most popular)
      db.query<{ game: string; count: number }>(
        'SELECT game, COUNT(*)::int AS count FROM game_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1) GROUP BY game ORDER BY count DESC',
        [tenantId]
      ),
      // Unique players (distinct users who have played at least one session)
      db.query<{ count: number }>(
        'SELECT COUNT(DISTINCT user_id)::int AS count FROM game_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)',
        [tenantId]
      ),
      // Top 10 players by total score, with rank assigned in SQL
      db.query<{ rank: number; name: string; games_played: number; total_score: number }>(
        `SELECT ROW_NUMBER() OVER (ORDER BY SUM(gs.score) DESC)::int AS rank,
                COALESCE(u.username, u.email)                         AS name,
                COUNT(gs.id)::int                                     AS games_played,
                SUM(gs.score)::int                                    AS total_score
           FROM game_sessions gs
           JOIN users u ON gs.user_id = u.id
          WHERE u.tenant_id = $1
          GROUP BY u.id, u.username, u.email
          ORDER BY total_score DESC
          LIMIT 10`,
        [tenantId]
      ),
    ]);

    // Build question status map for quick lookup
    const statusMap: Record<string, number> = {};
    for (const row of statusResult.rows) {
      statusMap[row.status] = row.count;
    }

    // The first row of gsGameResult is the most popular (sorted DESC)
    const most_popular_game = gsGameResult.rows[0]?.game ?? '';

    return {
      questions: {
        total: totalQsResult.rows[0]?.total ?? 0,
        draft: statusMap['draft'] ?? 0,
        pending_review: statusMap['in_review'] ?? 0,
        published: statusMap['published'] ?? 0,
        by_type: typeResult.rows,
      },
      game_sessions: {
        total: totalGsResult.rows[0]?.total ?? 0,
        most_popular_game,
        unique_players: uniquePlayersResult.rows[0]?.count ?? 0,
        by_game: gsGameResult.rows,
      },
      top_players: topPlayersResult.rows,
    };
  }
}
