import { createChildLogger } from '../../../utils/logger';
import { ItemBank, ItemBankListQuery } from '../models';
import {
  CreateItemBankRequest,
  ItemBanksRepository,
  UpdateItemBankRequest,
} from '../repository';

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

const log = createChildLogger('item-banks-service');

export class ItemBanksService {
  private repository: ItemBanksRepository;

  constructor() {
    this.repository = new ItemBanksRepository();
  }

  async findAll(
    userId: number,
    roles: string[],
    tenantId: number,
    query: ItemBankListQuery
  ): Promise<{ items: ItemBank[]; total: number; page: number; limit: number }> {
    log.info({ userId, roles }, 'findAll item banks');

    let courseAssignmentMode: string | null = null;
    if (!roles.includes('org_admin')) {
      courseAssignmentMode = await this.repository.getUserCourseMode(userId);
    }

    const result = await this.repository.findAll(userId, roles, tenantId, query, courseAssignmentMode);
    log.info({ total: result.total, page: result.page }, 'findAll complete');
    return result;
  }

  async findById(
    id: number,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<ItemBank | null> {
    log.info({ id, userId, roles }, 'findById item bank');
    const result = await this.repository.findById(id, userId, roles, tenantId);
    log.info({ id, found: result !== null }, 'findById complete');
    return result;
  }

  async create(data: CreateItemBankRequest, userId: number, tenantId: number): Promise<ItemBank> {
    log.info({ userId, tenantId }, 'create item bank');
    const result = await this.repository.create(data, userId, tenantId);
    log.info({ id: result.id }, 'item bank created');
    return result;
  }

  async update(
    id: number,
    data: UpdateItemBankRequest,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<ItemBank> {
    log.info({ id, userId, roles }, 'update item bank');
    const result = await this.repository.update(id, data, userId, roles, tenantId);
    log.info({ id }, 'item bank updated');
    return result;
  }

  async softDelete(id: number, userId: number, roles: string[], tenantId: number): Promise<void> {
    log.info({ id, userId, roles }, 'soft delete item bank');
    await this.repository.softDelete(id, userId, roles, tenantId);
    log.info({ id }, 'item bank soft deleted');
  }
}
