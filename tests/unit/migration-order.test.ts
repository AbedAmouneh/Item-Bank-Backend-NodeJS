import { describe, expect, test } from 'vitest';

import {
  extractCreatedTables,
  extractDependencies,
  orderMigrationFiles,
  type MigrationFile,
} from '../setup/scripts/migration-order';

describe('migration ordering helpers', () => {
  test('extracts created table names from SQL', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY);
      CREATE TABLE "items" (id SERIAL PRIMARY KEY);
    `;

    expect(extractCreatedTables(sql)).toEqual(['users', 'items']);
  });

  test('extracts dependency table names from SQL references', () => {
    const sql = `
      CREATE TABLE categories (
        created_by BIGINT REFERENCES users(id)
      );
      SELECT * FROM items i JOIN categories c ON c.id = i.category_id;
    `;

    expect(extractDependencies(sql)).toEqual([
      'users',
      'items',
      'categories',
    ]);
  });

  test('orders dependent migrations and keeps triggers last', () => {
    const files: MigrationFile[] = [
      {
        fileName: 'categories.sql',
        version: 'categories',
        sql: 'CREATE TABLE categories (created_by BIGINT REFERENCES users(id));',
      },
      {
        fileName: 'users.sql',
        version: 'users',
        sql: 'CREATE TABLE users (id BIGSERIAL PRIMARY KEY);',
      },
      {
        fileName: 'triggers.sql',
        version: 'triggers',
        sql: 'CREATE OR REPLACE FUNCTION set_timestamps() RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;',
      },
    ];

    const ordered = orderMigrationFiles(files).map(file => file.fileName);
    expect(ordered.indexOf('users.sql')).toBeLessThan(
      ordered.indexOf('categories.sql')
    );
    expect(ordered[ordered.length - 1]).toBe('triggers.sql');
  });

  test('throws on cyclic dependencies', () => {
    const files: MigrationFile[] = [
      {
        fileName: 'a.sql',
        version: 'a',
        sql: 'CREATE TABLE a (b_id BIGINT REFERENCES b(id));',
      },
      {
        fileName: 'b.sql',
        version: 'b',
        sql: 'CREATE TABLE b (a_id BIGINT REFERENCES a(id));',
      },
    ];

    expect(() => orderMigrationFiles(files)).toThrow(
      /unable to resolve migration order/i
    );
  });
});
