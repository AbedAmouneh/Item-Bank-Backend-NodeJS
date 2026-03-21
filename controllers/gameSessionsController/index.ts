import { HttpWrapper } from '../../platform/http';
import { getGameSessions } from './handlers/get_game_sessions';
import { getLeaderboard } from './handlers/get_leaderboard';
import { createGameSession } from './handlers/post_game_session';

export async function gameSessionRoutes(http: HttpWrapper): Promise<void> {
  await http.post('/game-sessions', createGameSession);
  await http.get('/game-sessions', getGameSessions);
  await http.get('/leaderboard', getLeaderboard, true);
}
