import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { config } from '../../utils/config';
import { createChildLogger } from '../../utils/logger';
import { runtime } from '../../utils/runtime';
import { assertSafeTestDatabaseTarget } from '../../utils/test-safeguards';
import { AuditLogger } from './audit-logger';

const logger = createChildLogger('database');

export class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor() {
    assertSafeTestDatabaseTarget(
      config.database.host,
      config.database.name,
      'Database connection'
    );

    const caPath = join(__dirname, '../../tests/setup/certificate/rds-ca.pem');
    const sslConfig = this.getSSLConfig(caPath);

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.pool.min,
      max: config.database.pool.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 60000,
      statement_timeout: 60000,
      query_timeout: 60000,
      ssl: sslConfig,
    });

    this.pool.on('error', err => {
      logger.error({ error: err }, 'Database pool error');
    });

    this.pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    this.pool.on('remove', () => {
      logger.debug('Database connection removed from pool');
    });
  }

  private getSSLConfig(caPath: string) {
    const localHosts = new Set(['localhost', '127.0.0.1', 'postgres', 'db']);
    if (
      config.server.env === 'test' ||
      localHosts.has(config.database.host.toLowerCase())
    ) {
      return false;
    }

    if (config.database.caCert) {
      return {
        rejectUnauthorized: true,
        ca: config.database.caCert,
      };
    }

    if (existsSync(caPath)) {
      try {
        const ca = readFileSync(caPath, 'utf8');
        return {
          rejectUnauthorized: true,
          ca,
        };
      } catch (error) {
        logger.warn(
          { error, caPath },
          'Failed to read CA certificate file, falling back to basic SSL'
        );
      }
    }

    return {
      rejectUnauthorized: false,
    };
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = runtime.now().getTime();
    const client = await this.pool.connect();

    try {
      const result = await client.query<T>(text, params);
      const duration = runtime.now().getTime() - start;

      // Get request ID from audit context for better tracing
      const context = AuditLogger.getContext();
      const requestId = context.requestId;

      // Log slow queries (>30s) as warnings
      const SLOW_QUERY_THRESHOLD_MS = 30000;
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(
          {
            requestId,
            query: text.substring(0, 200),
            duration,
            rows: result.rowCount,
            threshold: SLOW_QUERY_THRESHOLD_MS,
          },
          'Slow query detected'
        );
      } else {
        logger.debug(
          {
            requestId,
            query: text.substring(0, 100),
            duration,
            rows: result.rowCount,
          },
          'Database query executed'
        );
      }

      // Log to audit table (async, non-blocking)
      AuditLogger.logQuery(text, params, result, undefined, duration);

      return result;
    } catch (error) {
      const duration = runtime.now().getTime() - start;
      const context = AuditLogger.getContext();
      const requestId = context.requestId;

      logger.error(
        {
          requestId,
          query: text.substring(0, 100),
          duration,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          params: params?.map(() => '[REDACTED]'),
        },
        'Database query failed'
      );

      // Log failed query to audit table (async, non-blocking)
      AuditLogger.logQuery(text, params, undefined, error as Error, duration);

      throw error;
    } finally {
      client.release();
    }
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Transaction rolled back');
      throw error;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows.length === 1;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  public async close(): Promise<void> {
    const status = this.getPoolStatus();
    logger.info(
      {
        totalConnections: status.totalCount,
        idleConnections: status.idleCount,
        waitingRequests: status.waitingCount,
      },
      'Closing database connection pool...'
    );

    try {
      await this.pool.end();
      logger.info('Database pool closed successfully');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : error },
        'Error closing database pool'
      );
      throw error;
    }
  }

  public getPoolStatus(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Get detailed pool statistics with utilization metrics
   */
  public getPoolStats(): {
    total: number;
    idle: number;
    active: number;
    waiting: number;
    maxConnections: number;
    minConnections: number;
    utilizationPercent: number;
    availablePercent: number;
  } {
    const total = this.pool.totalCount;
    const idle = this.pool.idleCount;
    const active = total - idle;
    const waiting = this.pool.waitingCount;
    const max = config.database.pool.max;
    const min = config.database.pool.min;

    return {
      total,
      idle,
      active,
      waiting,
      maxConnections: max,
      minConnections: min,
      utilizationPercent: max > 0 ? Math.round((total / max) * 100) : 0,
      availablePercent: max > 0 ? Math.round((idle / max) * 100) : 0,
    };
  }

  /**
   * Log current pool statistics
   */
  public logPoolStats(): void {
    const stats = this.getPoolStats();

    // Warn if pool is heavily utilized (>80%)
    if (stats.utilizationPercent > 80) {
      logger.warn(stats, 'Database connection pool high utilization detected');
    } else {
      logger.info(stats, 'Database connection pool statistics');
    }

    // Warn if there are waiting requests
    if (stats.waiting > 0) {
      logger.warn(
        { waiting: stats.waiting, active: stats.active, total: stats.total },
        'Requests waiting for database connections'
      );
    }
  }
}

export const db = DatabaseConnection.getInstance();
