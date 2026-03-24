import { createChildLogger } from '../../../utils/logger';
import { AnalyticsOverview } from '../models';
import { AnalyticsRepository } from '../repository';

const log = createChildLogger('analytics-service');

export class AnalyticsService {
  private repository: AnalyticsRepository;

  constructor() {
    this.repository = new AnalyticsRepository();
  }

  async getOverview(tenantId: number): Promise<AnalyticsOverview> {
    log.info('getOverview');
    const result = await this.repository.getOverview(tenantId);
    log.info('getOverview complete');
    return result;
  }
}
