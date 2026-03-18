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
  data?: { token: string; expiresAt: string; user?: unknown };
  error?: { code: string; message: string };
}

export const PostRefreshTokenRoute = '/account/refresh' as const;
