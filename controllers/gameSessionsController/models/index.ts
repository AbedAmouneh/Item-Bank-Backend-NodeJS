import { z } from 'zod';

export const GameType = z.enum([
  'quiz-arcade',
  'memory-match',
  'answer-runner',
  'pixel-dash',
  'stack-attack',
  'meteor-catcher',
  'pixel-craft',
  'lava-climb',
  'word-blitz',
  'number-drop',
  'world-explorer',
  'pixel-snake',
  'bullseye-blaster',
  'lab-mixer',
  'ghost-hunt',
]);

export const CreateGameSessionSchema = z.object({
  game: GameType,
  score: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  total_qs: z.number().int().min(0),
  correct_qs: z.number().int().min(0),
  item_bank_id: z.number().int().optional(),
  extra_data: z.record(z.string(), z.unknown()).optional(),
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
  extra_data: Record<string, unknown> | null;
  played_at: Date;
}

export const GameStatRowSchema = z.object({
  game: GameType,
  sessions_played: z.string(),
  best_score: z.number(),
  avg_accuracy: z.number(),
  last_played: z.date(),
});

export interface GameStatRow {
  game: GameTypeEnum;
  sessions_played: string;
  best_score: number;
  avg_accuracy: number;
  last_played: Date;
}

export interface LeaderboardEntry {
  rank: number;
  user_name: string;
  score: number;
  accuracy: number;
  played_at: Date;
}
