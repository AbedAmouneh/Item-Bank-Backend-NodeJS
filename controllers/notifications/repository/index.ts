import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import { Notification } from '../models';

const log = createChildLogger('notifications-repository');

export class NotificationsRepository {
  async findByUser(userId: number): Promise<Notification[]> {
    const result = await db.query<Notification>(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    log.debug({ userId, count: result.rows.length }, 'findByUser complete');
    return result.rows;
  }

  async countUnread(userId: number): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async markAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
      [userId]
    );
    log.info({ userId }, 'All notifications marked as read');
  }
}
