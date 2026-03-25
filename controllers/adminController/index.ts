import { HttpWrapper } from '../../platform/http';
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
  await http.get('/admin/users', getUsers);
  await http.get('/admin/users/:id', getUser);
  await http.post('/admin/users', createUser);
  await http.put('/admin/users/:id', updateUser);
  await http.post('/admin/users/:id/activate', activateUser);
  await http.post('/admin/users/:id/deactivate', deactivateUser);
  await http.get('/admin/users/:id/item-banks', getUserItemBanks);
  await http.post('/admin/users/:id/item-banks/:itemBankId', assignUserItemBank);
  await http.delete('/admin/users/:id/item-banks/:itemBankId', revokeUserItemBank);
  await http.get('/admin/audit-logs', getAuditLogs);
}
