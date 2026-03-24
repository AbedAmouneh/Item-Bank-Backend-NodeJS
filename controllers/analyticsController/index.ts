import { HttpWrapper } from '../../platform/http';
import { getOverview } from './handlers/get_overview';

export async function analyticsRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/analytics/overview', getOverview);
}
