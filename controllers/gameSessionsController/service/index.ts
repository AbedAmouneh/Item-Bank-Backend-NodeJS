import { createChildLogger } from '../../../utils/logger';
import {
  CreateGameSessionInput,
  GameSession,
  GameSessionListQuery,
  LeaderboardEntry,
  LeaderboardQuery,
} from '../models';
import { GameSessionsRepository } from '../repository';

const log = createChildLogger('game-sessions-service');

export class GameSessionsService {
  private repository: GameSessionsRepository;

  constructor() {
    this.repository = new GameSessionsRepository();
  }

  async create(data: CreateGameSessionInput, userId: number): Promise<GameSession> {
    log.info({ userId, game: data.game }, 'create game session');
    const result = await this.repository.create(data, userId);
    log.info({ id: result.id }, 'game session created');
    return result;
  }

  async findByUser(
    userId: number,
    query: GameSessionListQuery
  ): Promise<{ items: GameSession[]; total: number; page: number; limit: number }> {
    log.info({ userId }, 'findByUser game sessions');
    const result = await this.repository.findByUser(userId, query);
    log.info({ total: result.total, page: result.page }, 'findByUser complete');
    return result;
  }

  async leaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    log.info({ game: query.game, item_bank_id: query.item_bank_id }, 'leaderboard');
    const result = await this.repository.leaderboard(query);
    log.info({ count: result.length }, 'leaderboard complete');
    return result;
  }
}
