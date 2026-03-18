import { z } from 'zod';

import { ROLE_VALUES } from '../common';

export const PostCreateUserRoute = '/users' as const;

export const createUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLE_VALUES),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
