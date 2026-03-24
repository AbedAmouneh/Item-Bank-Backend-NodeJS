import { z } from 'zod';

export const PostLoginRoute = '/account/login' as const;
export const PostLoginRouteMethod = 'POST' as const;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface LoginApiResponse {
  success: boolean;
  data?: {
    csrf_token: string;
    expires_in: number;
    user: {
      id: string;
      email: string;
      role: string;
      is_active: boolean;
      tenant_id: number;
      roles: string[];
    };
  };
  error?: { code: string; message: string };
}

export const PostRefreshTokenRoute = '/account/refresh' as const;

export const GetMeRoute = '/account/me' as const;

export interface GetMeApiResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    tenant_id: number;
    roles: string[];
  };
  error?: { code: string; message: string };
}
