import { PostRefreshTokenRoute } from '../../types/api/account';
import { HttpWrapper } from '../../platform/http';
import { getMe, GetMeRoute } from './handlers/get_me';
import { login, PostLoginRoute } from './handlers/post_login';
import { logout, PostLogoutRoute } from './handlers/post_logout';
import { refreshToken } from './handlers/post_refresh_token';
import { register, PostRegisterRoute } from './handlers/post_register';

export async function authRoutes(http: HttpWrapper): Promise<void> {
  await http.post(PostLoginRoute, login, true, undefined, {
    rateLimit: { max: 10, timeWindow: '1 minute' },
  });
  await http.post(PostRegisterRoute, register, true, undefined, {
    rateLimit: { max: 5, timeWindow: '1 minute' },
  });
  await http.post(PostRefreshTokenRoute, refreshToken, true);
  await http.post(PostLogoutRoute, logout, true);
  await http.get(GetMeRoute, getMe);
}
