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
  async getUserCourseMode(userId: number): Promise<string | null> {
    const result = await db.query<{ course_assignment_mode: string | null }>(
      `SELECT course_assignment_mode FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.course_assignment_mode ?? null;
  }

  async findAll(
    userId: number,
    isAdmin: boolean,
    tenantId: number,
    query: ItemBankListQuery,
    courseAssignmentMode: string | null = null
  ): Promise<{ items: ItemBank[]; total: number; page: number; limit: number }> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ib.is_active = true', 'ib.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;
    let joinClause = '';

    if (!isAdmin) {
      if (courseAssignmentMode === 'assigned_only') {
        joinClause = `JOIN user_item_bank_access uiba ON ib.id = uiba.item_bank_id`;
        conditions.push(`uiba.user_id = $${paramIndex++}`);
        params.push(userId);
      } else {
        conditions.push(`ib.owner_id = $${paramIndex++}`);
        params.push(userId);
      }
    }

    if (search !== undefined) {
      conditions.push(`ib.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM item_banks ib ${joinClause} ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<ItemBank>(
      `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
       FROM item_banks ib
       ${joinClause}
       ${whereClause}
       ORDER BY ib.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    log.debug({ page, limit, total, isAdmin, courseAssignmentMode }, 'findAll item banks');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(
    id: number,
    userId: number,
    isAdmin: boolean,
    tenantId: number
  ): Promise<ItemBank | null> {
    const queryText = isAdmin
      ? `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
         FROM item_banks ib
         WHERE ib.id = $1 AND ib.is_active = true AND ib.tenant_id = $2`
      : `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY}
         FROM item_banks ib
         WHERE ib.id = $1 AND ib.is_active = true AND ib.tenant_id = $2 AND ib.owner_id = $3`;

    const queryParams: unknown[] = isAdmin ? [id, tenantId] : [id, tenantId, userId];

    const result = await db.query<ItemBank>(queryText, queryParams);
    return result.rows[0] ?? null;
  }

  async create(data: CreateItemBankRequest, ownerId: number, tenantId: number): Promise<ItemBank> {
    const result = await db.query<Omit<ItemBank, 'question_count'>>(
      `INSERT INTO item_banks (owner_id, name, description, tenant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ownerId, data.name, data.description ?? null, tenantId]
    );

    const itemBank = result.rows[0];
    if (!itemBank) throw new Error('Failed to create item bank');

    log.info({ id: itemBank.id, ownerId, tenantId }, 'Item bank created');
    return { ...itemBank, question_count: 0 };
  }

  // Runs the UPDATE unconditionally — the service is responsible for verifying
  // existence and permissions before calling this method.
  async update(id: number, data: UpdateItemBankRequest): Promise<ItemBank> {
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

    const result = await db.query<ItemBank>(
      `SELECT ib.*, ${QUESTION_COUNT_SUBQUERY} FROM item_banks ib WHERE ib.id = $1`,
      [id]
    );
    const updated = result.rows[0];
    if (!updated) throw new Error('Failed to retrieve updated item bank');

    log.info({ id }, 'Item bank updated');
    return updated;
  }

  // Soft-deletes unconditionally — the service is responsible for verifying
  // existence and permissions before calling this method.
  async softDelete(id: number): Promise<void> {
    await db.query('UPDATE item_banks SET is_active = false WHERE id = $1', [id]);
    log.info({ id }, 'Item bank soft deleted');
  }
}
