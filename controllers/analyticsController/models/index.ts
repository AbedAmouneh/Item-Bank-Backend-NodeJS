/** A single question-type breakdown entry. */
export interface QuestionTypeBreakdown {
  type: string;
  count: number;
}

/** A single game's session count entry. */
export interface GameSessionCount {
  game: string;
  count: number;
}

/** One player in the global leaderboard. */
export interface TopPlayer {
  rank: number;
  name: string;
  games_played: number;
  total_score: number;
}

/**
 * Full analytics overview returned by GET /analytics/overview.
 * Shape matches the frontend AnalyticsOverview contract exactly.
 */
export interface AnalyticsOverview {
  questions: {
    total: number;
    draft: number;
    pending_review: number;
    published: number;
    by_type: QuestionTypeBreakdown[];
  };
  game_sessions: {
    total: number;
    most_popular_game: string;
    unique_players: number;
    by_game: GameSessionCount[];
  };
  top_players: TopPlayer[];
}
