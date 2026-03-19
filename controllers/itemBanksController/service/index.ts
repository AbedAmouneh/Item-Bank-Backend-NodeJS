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
    role: string,
    query: ItemBankListQuery
  ): Promise<{ items: ItemBank[]; total: number; page: number; limit: number }> {
    log.info({ userId, role }, 'findAll item banks');
    const result = await this.repository.findAll(userId, role, query);
    log.info({ total: result.total, page: result.page }, 'findAll complete');
    return result;
  }

  async findById(
    id: number,
    userId: number,
    role: string
  ): Promise<ItemBank | null> {
    log.info({ id, userId, role }, 'findById item bank');
    const result = await this.repository.findById(id, userId, role);
    log.info({ id, found: result !== null }, 'findById complete');
    return result;
  }

  async create(data: CreateItemBankRequest, userId: number): Promise<ItemBank> {
    log.info({ userId }, 'create item bank');
    const result = await this.repository.create(data, userId);
    log.info({ id: result.id }, 'item bank created');
    return result;
  }

  async update(
    id: number,
    data: UpdateItemBankRequest,
    userId: number,
    role: string
  ): Promise<ItemBank> {
    log.info({ id, userId, role }, 'update item bank');
    const result = await this.repository.update(id, data, userId, role);
    log.info({ id }, 'item bank updated');
    return result;
  }

  async softDelete(id: number, userId: number, role: string): Promise<void> {
    log.info({ id, userId, role }, 'soft delete item bank');
    await this.repository.softDelete(id, userId, role);
    log.info({ id }, 'item bank soft deleted');
  }
}
