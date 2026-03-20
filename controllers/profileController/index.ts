import { HttpWrapper } from '../../platform/http';
import { changePassword, ChangePasswordRoute } from './handlers/put_change_password';
import { getProfile, GetProfileRoute } from './handlers/get_me';
import { updateProfile, UpdateProfileRoute } from './handlers/put_me';

export async function profileRoutes(http: HttpWrapper): Promise<void> {
  await http.get(GetProfileRoute, getProfile);
  await http.put(UpdateProfileRoute, updateProfile);
  await http.put(ChangePasswordRoute, changePassword);
}
