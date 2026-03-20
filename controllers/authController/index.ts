import { PostRefreshTokenRoute } from '../../types/api/account';
import { HttpWrapper } from '../../platform/http';
import { getMe, GetMeRoute } from './handlers/get_me';
import { login, PostLoginRoute } from './handlers/post_login';
import { logout, PostLogoutRoute } from './handlers/post_logout';
import { refreshToken } from './handlers/post_refresh_token';

// User creation is handled via POST /admin/users (adminController)

export async function authRoutes(http: HttpWrapper): Promise<void> {
  await http.post(PostLoginRoute, login, true);
  await http.post(PostRefreshTokenRoute, refreshToken, true);
  await http.post(PostLogoutRoute, logout);
  await http.get(GetMeRoute, getMe);
}
