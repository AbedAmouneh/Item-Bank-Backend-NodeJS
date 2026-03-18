import { QueryResult, QueryResultRow } from 'pg';

import { db } from './connection';

export class QueryBuilder {
  private _select: string[] = [];
  private _from: string = '';
  private _joins: string[] = [];
  private _where: string[] = [];
  private _orderBy: string[] = [];
  private _limit?: number;
  private _offset?: number;
  private _params: unknown[] = [];

  public select(columns: string[]): QueryBuilder {
    this._select = columns;
    return this;
  }

  public from(table: string): QueryBuilder {
    this._from = table;
    return this;
  }

  public join(table: string, condition: string): QueryBuilder {
    this._joins.push(`JOIN ${table} ON ${condition}`);
    return this;
  }

  public leftJoin(table: string, condition: string): QueryBuilder {
    this._joins.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  public where(condition: string, ...params: unknown[]): QueryBuilder {
    this._where.push(condition);
    this._params.push(...params);
    return this;
  }

  public orderBy(
    column: string,
    direction: 'ASC' | 'DESC' = 'ASC'
  ): QueryBuilder {
    this._orderBy.push(`${column} ${direction}`);
    return this;
  }

  public limit(count: number): QueryBuilder {
    this._limit = count;
    return this;
  }

  public offset(count: number): QueryBuilder {
    this._offset = count;
    return this;
  }

  public build(): { query: string; params: unknown[] } {
    let query = `SELECT ${this._select.join(', ')} FROM ${this._from}`;

    if (this._joins.length > 0) {
      query += ` ${this._joins.join(' ')}`;
    }

    if (this._where.length > 0) {
      query += ` WHERE ${this._where.join(' AND ')}`;
    }

    if (this._orderBy.length > 0) {
      query += ` ORDER BY ${this._orderBy.join(', ')}`;
    }

    if (this._limit !== undefined) {
      query += ` LIMIT ${this._limit}`;
    }

    if (this._offset !== undefined) {
      query += ` OFFSET ${this._offset}`;
    }

    return { query, params: this._params };
  }

  public async execute<T extends QueryResultRow = QueryResultRow>(): Promise<
    QueryResult<T>
  > {
    const { query, params } = this.build();
    return db.query<T>(query, params);
  }
}

export function createQuery(): QueryBuilder {
  return new QueryBuilder();
}

export async function findById<T extends QueryResultRow>(
  table: string,
  id: string | number,
  columns: string[] = ['*']
): Promise<T | null> {
  const result = await createQuery()
    .select(columns)
    .from(table)
    .where('id = $1', id)
    .execute<T>();

  return result.rows[0] || null;
}

export async function findMany<T extends QueryResultRow>(
  table: string,
  conditions: Record<string, unknown> = {},
  columns: string[] = ['*'],
  orderBy?: string,
  limit?: number,
  offset?: number
): Promise<T[]> {
  const query = createQuery().select(columns).from(table);

  const conditionKeys = Object.keys(conditions);
  conditionKeys.forEach((key, index) => {
    query.where(`${key} = $${index + 1}`, conditions[key]);
  });

  if (orderBy) {
    const parts = orderBy.split(' ');
    const column = parts[0] || 'id';
    const direction = (parts[1]?.toUpperCase() as 'ASC' | 'DESC') || 'ASC';
    query.orderBy(column, direction);
  }

  if (limit) query.limit(limit);
  if (offset) query.offset(offset);

  const result = await query.execute<T>();
  return result.rows;
}

export async function create<T extends QueryResultRow>(
  table: string,
  data: Record<string, unknown>,
  returning: string[] = ['*']
): Promise<T> {
  // Filter out timestamp fields so DB defaults apply
  const filteredData = { ...data };
  delete filteredData['created_on'];
  delete filteredData['updated_on'];
  delete filteredData['created_at'];
  delete filteredData['updated_at'];

  const columns = Object.keys(filteredData);
  const values = Object.values(filteredData);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING ${returning.join(', ')}
  `;

  const result = await db.query<T>(query, values);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Failed to create record in ${table}`);
  }
  return row;
}

export async function update<T extends QueryResultRow>(
  table: string,
  id: string | number,
  data: Record<string, unknown>,
  returning: string[] = ['*']
): Promise<T | null> {
  // Filter out timestamp fields so DB defaults apply
  const filteredData = { ...data };
  delete filteredData['created_on'];
  delete filteredData['updated_on'];
  delete filteredData['created_at'];
  delete filteredData['updated_at'];

  const columns = Object.keys(filteredData);
  const values = Object.values(filteredData);
  const setClause = columns
    .map((col, index) => `${col} = $${index + 2}`)
    .join(', ');

  const query = `
    UPDATE ${table}
    SET ${setClause}
    WHERE id = $1
    RETURNING ${returning.join(', ')}
  `;

  const result = await db.query<T>(query, [id, ...values]);
  return result.rows[0] || null;
}

export async function deleteById(
  table: string,
  id: string | number
): Promise<boolean> {
  const query = `DELETE FROM ${table} WHERE id = $1`;
  const result = await db.query(query, [id]);
  return (result.rowCount ?? 0) > 0;
}
