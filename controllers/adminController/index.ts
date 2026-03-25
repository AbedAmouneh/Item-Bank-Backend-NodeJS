import { HttpWrapper } from '../../platform/http';
import { authenticateToken } from '../../platform/http/middlewares/auth';
import { requireAdmin } from '../../platform/http/middlewares/requireAdmin';
import { requireAuthentication } from '../../platform/http/middlewares/security';
import { revokeUserItemBank } from './handlers/delete_user_item_bank';
import { getAuditLogs } from './handlers/get_audit_logs';
import { getUser } from './handlers/get_user';
import { getUsers } from './handlers/get_users';
import { getUserItemBanks } from './handlers/get_user_item_banks';
import { activateUser } from './handlers/post_activate_user';
import { deactivateUser } from './handlers/post_deactivate_user';
import { createUser } from './handlers/post_user';
import { assignUserItemBank } from './handlers/post_user_item_bank';
import { updateUser } from './handlers/put_user';

export async function adminRoutes(http: HttpWrapper): Promise<void> {
  http.instance.addHook('preHandler', authenticateToken);
  http.instance.addHook('preHandler', requireAuthentication);
  http.instance.addHook('preHandler', requireAdmin);

  await http.get('/admin/users', getUsers, true);
  await http.get('/admin/users/:id', getUser, true);
  await http.post('/admin/users', createUser, true);
  await http.put('/admin/users/:id', updateUser, true);
  await http.post('/admin/users/:id/activate', activateUser, true);
  await http.post('/admin/users/:id/deactivate', deactivateUser, true);
  await http.get('/admin/users/:id/item-banks', getUserItemBanks, true);
  await http.post('/admin/users/:id/item-banks/:itemBankId', assignUserItemBank, true);
  await http.delete('/admin/users/:id/item-banks/:itemBankId', revokeUserItemBank, true);
  await http.get('/admin/audit-logs', getAuditLogs, true);
}
