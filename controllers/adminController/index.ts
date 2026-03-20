import { HttpWrapper } from '../../platform/http';
import { getUser } from './handlers/get_user';
import { getUsers } from './handlers/get_users';
import { activateUser } from './handlers/post_activate_user';
import { deactivateUser } from './handlers/post_deactivate_user';
import { createUser } from './handlers/post_user';
import { updateUser } from './handlers/put_user';

export async function adminRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/admin/users', getUsers);
  await http.get('/admin/users/:id', getUser);
  await http.post('/admin/users', createUser);
  await http.put('/admin/users/:id', updateUser);
  await http.post('/admin/users/:id/activate', activateUser);
  await http.post('/admin/users/:id/deactivate', deactivateUser);
}
