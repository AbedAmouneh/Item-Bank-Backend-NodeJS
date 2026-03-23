import { HttpWrapper } from '../../platform/http';
import { getNotifications } from './handlers/get_notifications';
import { getUnreadCount } from './handlers/get_unread_count';
import { markAllNotificationsRead } from './handlers/patch_mark_all_read';
import { markNotificationRead } from './handlers/patch_mark_read';

export async function notificationRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/notifications', getNotifications);
  await http.get('/notifications/unread-count', getUnreadCount);
  await http.patch('/notifications/read-all', markAllNotificationsRead);
  await http.patch('/notifications/:id/read', markNotificationRead);
}
