import { FastifyReply } from 'fastify';

import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';
import { ApiResponse } from '../../../types/common';
import { createChildLogger } from '../../../utils/logger';
import { AdminUser, CreateUserSchema } from '../models';
import { AdminService } from '../service';

const logger = createChildLogger('admin-controller');
const adminService = new AdminService();

export async function createUser(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const validatedData = CreateUserSchema.parse(request.body);
    const user = await adminService.create(validatedData);

    const response: ApiResponse<AdminUser> = { success: true, data: user };
    return reply.status(201).send(response);
  } catch (error) {
    logger.error({ error }, 'POST /admin/users failed');

    return reply.status(400).send({
      success: false,
      error: {
        code: 'CREATE_USER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create user',
      },
    });
  }
}
