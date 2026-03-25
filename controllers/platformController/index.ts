import {
  PlatformHttpWrapper,
  requirePlatformRole,
} from '../../platform/auth/verifyPlatformJWT';
import { getPlatformMe } from './handlers/get_platform_me';
import { getPlatformUsers } from './handlers/get_platform_users';
import { getTenant } from './handlers/get_tenant';
import { getTenants } from './handlers/get_tenants';
import { patchTenant } from './handlers/patch_tenant';
import { postPlatformLogin } from './handlers/post_platform_login';
import { postPlatformUser } from './handlers/post_platform_user';
import { postTenant } from './handlers/post_tenant';

export async function platformRoutes(http: PlatformHttpWrapper): Promise<void> {
  // Auth
  await http.post('/platform/auth/login', postPlatformLogin, true);
  await http.get('/platform/auth/me', getPlatformMe);

  // Tenants
  await http.get('/platform/tenants', getTenants);
  await http.post('/platform/tenants', postTenant);
  await http.get('/platform/tenants/:id', getTenant);
  await http.patch('/platform/tenants/:id', patchTenant);

  // Platform users (super_admin only)
  await http.get('/platform/users', getPlatformUsers, false, [requirePlatformRole('super_admin')]);
  await http.post('/platform/users', postPlatformUser, false, [requirePlatformRole('super_admin')]);
}
