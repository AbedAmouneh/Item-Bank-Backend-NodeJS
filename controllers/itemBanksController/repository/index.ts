import { db } from '../../../platform/database/connection';
import { createChildLogger } from '../../../utils/logger';
import {
  CreateItemBankInput,
  ItemBank,
  ItemBankListQuery,
  UpdateItemBankInput,
} from '../models';

export type CreateItemBankRequest = CreateItemBankInput;
export type UpdateItemBankRequest = UpdateItemBankInput;

const log = createChildLogger('item-banks-repository');

const QUESTION_COUNT_SUBQUERY = `COALESCE((SELECT COUNT(*)::int FROM questions q WHERE q.item_bank_id = ib.id), 0) AS question_count`;

export class ItemBanksRepository {
  async findAll(
    userId: number,
    role: string,
    query: ItemBankListQuery
  ): Promise<{ items: ItemBank[]; total: number; page: number; limit: number }> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ib.is_active = true'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role === 'user') {
      conditions.push(`ib.owner_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (search !== undefined) {
      conditions.push(`ib.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM item_banks ib ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<ItemBank>(
      `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
       FROM item_banks ib
       ${whereClause}
       ORDER BY ib.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    log.debug({ page, limit, total, role }, 'findAll item banks');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(
    id: number,
    userId: number,
    role: string
  ): Promise<ItemBank | null> {
    const queryText =
      role === 'admin'
        ? `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
           FROM item_banks ib
           WHERE ib.id = $1 AND ib.is_active = true`
        : `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
           FROM item_banks ib
           WHERE ib.id = $1 AND ib.is_active = true AND ib.owner_id = $2`;

    const queryParams = role === 'admin' ? [id] : [id, userId];

    const result = await db.query<ItemBank>(queryText, queryParams);
    return result.rows[0] ?? null;
  }

  async create(data: CreateItemBankRequest, ownerId: number): Promise<ItemBank> {
    const result = await db.query<Omit<ItemBank, 'question_count'>>(
      `INSERT INTO item_banks (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ownerId, data.name, data.description ?? null]
    );

    const itemBank = result.rows[0];
    if (!itemBank) throw new Error('Failed to create item bank');

    log.info({ id: itemBank.id, ownerId }, 'Item bank created');
    return { ...itemBank, question_count: 0 };
  }

  async update(
    id: number,
    data: UpdateItemBankRequest,
    userId: number,
    role: string
  ): Promise<ItemBank> {
    const existing = await this.findById(id, userId, role);
    if (!existing) throw new Error('Item bank not found or access denied');

    const updateFields: Record<string, unknown> = {};
    if (data.name !== undefined) updateFields['name'] = data.name;
    if (data.description !== undefined) updateFields['description'] = data.description;

    if (Object.keys(updateFields).length > 0) {
      const setClauses = Object.keys(updateFields).map(
        (col, i) => `${col} = $${i + 2}`
      );
      await db.query(
        `UPDATE item_banks SET ${setClauses.join(', ')} WHERE id = $1`,
        [id, ...Object.values(updateFields)]
      );
    }

    const updated = await this.findById(id, userId, role);
    if (!updated) throw new Error('Failed to retrieve updated item bank');

    log.info({ id }, 'Item bank updated');
    return updated;
  }

  async softDelete(id: number, userId: number, role: string): Promise<void> {
    const existing = await this.findById(id, userId, role);
    if (!existing) throw new Error('Item bank not found or access denied');

    await db.query('UPDATE item_banks SET is_active = false WHERE id = $1', [id]);
    log.info({ id }, 'Item bank soft deleted');
  }
}
