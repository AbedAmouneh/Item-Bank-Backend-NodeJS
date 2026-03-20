import bcrypt from 'bcryptjs';

import { config } from '../../../utils/config';
import { createChildLogger } from '../../../utils/logger';
import { AdminUser, AdminUserListQuery, CreateUserInput, UpdateUserInput } from '../models';
import { AdminRepository } from '../repository';

const logger = createChildLogger('admin-service');

export class AdminService {
  private repository: AdminRepository;

  constructor() {
    this.repository = new AdminRepository();
  }

  async findAll(
    query: AdminUserListQuery
  ): Promise<{ items: AdminUser[]; total: number; page: number; limit: number }> {
    const result = await this.repository.findAll(query);
    logger.info({ page: query.page, total: result.total }, 'Listed users');
    return result;
  }

  async findById(id: number): Promise<AdminUser | null> {
    return this.repository.findById(id);
  }

  async create(data: CreateUserInput): Promise<AdminUser> {
    const password_hash = await bcrypt.hash(
      data.password,
      config.security.bcryptRounds
    );
    const user = await this.repository.create({
      email: data.email,
      password_hash,
      role: data.role,
    });
    logger.info({ userId: user.id, email: user.email }, 'User created by admin');
    return user;
  }

  async update(id: number, data: UpdateUserInput): Promise<AdminUser | null> {
    const user = await this.repository.update(id, data);
    logger.info({ userId: id }, 'User updated by admin');
    return user;
  }

  async activate(id: number): Promise<void> {
    await this.repository.activate(id);
    logger.info({ userId: id }, 'User activated by admin');
  }

  async deactivate(id: number): Promise<void> {
    await this.repository.deactivate(id);
    logger.info({ userId: id }, 'User deactivated by admin, sessions cleared');
  }
}
