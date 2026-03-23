import { createChildLogger } from '../../../utils/logger';
import { Notification } from '../models';
import { NotificationsRepository } from '../repository';

const log = createChildLogger('notifications-service');

export class NotificationsService {
  private repository: NotificationsRepository;

  constructor() {
    this.repository = new NotificationsRepository();
  }

  async getForUser(userId: number): Promise<Notification[]> {
    log.info({ userId }, 'getForUser');
    return this.repository.findByUser(userId);
  }

  async getUnreadCount(userId: number): Promise<number> {
    log.info({ userId }, 'getUnreadCount');
    return this.repository.countUnread(userId);
  }

  async markAsRead(id: number, userId: number): Promise<boolean> {
    log.info({ id, userId }, 'markAsRead');
    return this.repository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: number): Promise<void> {
    log.info({ userId }, 'markAllAsRead');
    await this.repository.markAllAsRead(userId);
  }
}
