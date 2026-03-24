import { createChildLogger } from '../../../utils/logger';
import { Notification } from '../models';
import { NotificationsRepository } from '../repository';

const log = createChildLogger('notifications-service');

export class NotificationsService {
  private repository: NotificationsRepository;

  constructor() {
    this.repository = new NotificationsRepository();
  }

  async getForUser(userId: number, tenantId: number): Promise<Notification[]> {
    log.info({ userId, tenantId }, 'getForUser');
    return this.repository.findByUser(userId, tenantId);
  }

  async getUnreadCount(userId: number, tenantId: number): Promise<number> {
    log.info({ userId, tenantId }, 'getUnreadCount');
    return this.repository.countUnread(userId, tenantId);
  }

  async markAsRead(id: number, userId: number, tenantId: number): Promise<boolean> {
    log.info({ id, userId, tenantId }, 'markAsRead');
    return this.repository.markAsRead(id, userId, tenantId);
  }

  async markAllAsRead(userId: number, tenantId: number): Promise<void> {
    log.info({ userId, tenantId }, 'markAllAsRead');
    await this.repository.markAllAsRead(userId, tenantId);
  }
}
