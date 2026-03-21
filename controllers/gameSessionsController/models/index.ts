import { z } from 'zod';

export const GameType = z.enum(['quiz-arcade', 'memory-match', 'answer-runner']);

export const CreateGameSessionSchema = z.object({
  game: GameType,
  score: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  total_qs: z.number().int().min(0),
  correct_qs: z.number().int().min(0),
  item_bank_id: z.number().int().optional(),
});

export const GameSessionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const LeaderboardQuerySchema = z.object({
  game: GameType,
  item_bank_id: z.coerce.number().int().optional(),
});

export type GameTypeEnum = z.infer<typeof GameType>;
export type CreateGameSessionInput = z.infer<typeof CreateGameSessionSchema>;
export type GameSessionListQuery = z.infer<typeof GameSessionListQuerySchema>;
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export interface GameSession {
  id: number;
  user_id: number;
  game: GameTypeEnum;
  score: number;
  accuracy: number;
  total_qs: number;
  correct_qs: number;
  item_bank_id: number | null;
  played_at: Date;
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  score: number;
  accuracy: number;
  played_at: Date;
}
