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

export const PostRegisterRoute = '/account/register' as const;

export const publicRegisterSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterRequest = z.infer<typeof publicRegisterSchema>;

export interface GetMeApiResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    tenant_id: number;
    roles: string[];
  };
  error?: { code: string; message: string };
}
