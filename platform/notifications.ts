import { db } from './database/connection';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('notifications-platform');

interface NotificationPayload {
  user_id: number;
  tenant_id: number;
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: number;
}

export async function createNotification(
  payload: NotificationPayload
): Promise<void> {
  await db.query(
    `INSERT INTO notifications (user_id, tenant_id, type, title, body, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      payload.user_id,
      payload.tenant_id,
      payload.type,
      payload.title,
      payload.body ?? null,
      payload.entity_type ?? null,
      payload.entity_id ?? null,
    ]
  );
  log.info({ user_id: payload.user_id, type: payload.type }, 'Notification created');
}

export async function notifyAllAdmins(
  payload: Omit<NotificationPayload, 'user_id'>
): Promise<void> {
  const result = await db.query<{ id: number }>(
    `SELECT DISTINCT ur.user_id AS id
     FROM user_roles ur
     WHERE ur.role = 'org_admin' AND ur.tenant_id = $1`,
    [payload.tenant_id]
  );
  for (const admin of result.rows) {
    await createNotification({ ...payload, user_id: admin.id });
  }
  log.info({ adminCount: result.rows.length, type: payload.type }, 'Admins notified');
}
