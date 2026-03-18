import { AsyncLocalStorage } from 'async_hooks';
import { QueryResult, QueryResultRow } from 'pg';

import { createChildLogger } from '../../utils/logger';

const logger = createChildLogger('audit-logger');

interface AuditContext {
  userId?: number | null;
  ipAddress?: string;
  userAgent?: string | null;
  requestId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}

interface AuditLogEntry {
  user_id?: number | null;
  request_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address: string;
  user_agent?: string | null;
  query_text: string;
  query_params?: any[] | null;
  timestamp: Date;
  duration_ms?: number | null;
  success: boolean;
}

interface QueuedAuditEntry {
  auditEntry: AuditLogEntry;
  originalQuery: string;
}

export class AuditLogger {
  private static asyncLocalStorage = new AsyncLocalStorage<AuditContext>();
  private static auditQueue: QueuedAuditEntry[] = [];
  private static processingQueue = false;
  private static readonly MAX_QUEUE_SIZE = 10000; // Increased for bulk imports
  private static readonly MAX_CAPTURED_ROWS = 10; // Limit bulk operation data capture

  // Set audit context (usually from middleware)
  public static setContext(context: Partial<AuditContext>): void {
    const currentContext = this.asyncLocalStorage.getStore() || {};
    this.asyncLocalStorage.enterWith({ ...currentContext, ...context });
  }

  // Clear audit context
  public static clearContext(): void {
    this.asyncLocalStorage.enterWith({});
  }

  // Get current audit context
  public static getContext(): AuditContext {
    return this.asyncLocalStorage.getStore() || {};
  }

  // Run callback within audit context
  public static runWithContext<T>(context: AuditContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  // Log database query to audit_logs table
  public static async logQuery(
    queryText: string,
    params?: unknown[],
    result?: QueryResult<QueryResultRow>,
    error?: Error,
    duration?: number
  ): Promise<void> {
    try {
      // Skip logging audit_logs table queries to avoid infinite recursion
      const auditTablePattern =
        /\b(?:from|into|update|join)\s+("?)audit_logs\1\b/i;
      if (auditTablePattern.test(queryText)) {
        return;
      }

      // Skip health checks and other system queries first
      const query = queryText.toLowerCase().trim();
      if (
        query.includes('select 1 as health_check') ||
        query.includes('begin') ||
        query.includes('commit') ||
        query.includes('rollback')
      ) {
        return;
      }

      // Skip spammy tables that generate too much noise
      const spammyTables = ['http_logs', 'user_sessions'];
      const spammyTablesPattern = new RegExp(
        `\\b(?:from|into|update|join)\\s+("?)(?:${spammyTables.join('|')})\\1\\b`,
        'i'
      );
      if (spammyTablesPattern.test(queryText)) {
        return;
      }

      // Skip COUNT queries only if they are SELECT queries (pagination/stats are noisy)
      if (query.startsWith('select') && query.includes('count(')) {
        return;
      }

      // Skip pure READ operations (but allow mutations in WITH clauses)
      if (query.startsWith('select') && !this.containsMutationKeywords(query)) {
        return;
      }

      const auditEntry = this.createAuditEntry(
        queryText,
        params,
        result,
        error,
        duration
      );

      // Queue audit entry for processing with backpressure
      this.queueAuditEntry(auditEntry, queryText);
    } catch (auditError) {
      logger.error(
        {
          auditError:
            auditError instanceof Error ? auditError.message : auditError,
          stack: auditError instanceof Error ? auditError.stack : undefined,
          originalQuery: queryText.substring(0, 100),
        },
        'Audit logging failed'
      );
    }
  }

  // Queue audit entry with backpressure protection
  private static queueAuditEntry(
    auditEntry: AuditLogEntry,
    originalQuery: string
  ): void {
    if (this.auditQueue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn(
        {
          queueSize: this.auditQueue.length,
          droppedQuery: originalQuery.substring(0, 100),
        },
        'Audit queue full, dropping audit entry'
      );
      return;
    }

    const queuedEntry: QueuedAuditEntry = {
      auditEntry,
      originalQuery,
    };

    this.auditQueue.push(queuedEntry);
    this.processAuditQueue();
  }

  // Process audit queue with proper async handling
  private static async processAuditQueue(): Promise<void> {
    if (this.processingQueue || this.auditQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.auditQueue.length > 0) {
      const queuedEntry = this.auditQueue.shift();
      if (!queuedEntry) break;

      try {
        await this.writeAuditLog(
          queuedEntry.auditEntry,
          queuedEntry.originalQuery
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            originalQuery: queuedEntry.originalQuery.substring(0, 100),
          },
          'Failed to write queued audit entry'
        );
      }
    }

    this.processingQueue = false;
  }

  // Check if query contains mutation keywords (for WITH clauses)
  private static containsMutationKeywords(query: string): boolean {
    const mutationKeywords = ['insert', 'update', 'delete', 'merge', 'upsert'];
    const mutationPattern = new RegExp(
      `\\b(?:${mutationKeywords.join('|')})\\b`,
      'i'
    );
    return mutationPattern.test(query);
  }

  // Sanitize parameters to ensure they're JSON-serializable
  private static sanitizeParams(params: unknown[]): any[] {
    return params.map(param => {
      if (param === null || param === undefined) {
        return null;
      }
      if (param instanceof Date) {
        return param.toISOString();
      }
      // Preserve primitive types (string, number, boolean)
      if (
        typeof param === 'string' ||
        typeof param === 'number' ||
        typeof param === 'boolean'
      ) {
        return param;
      }
      if (typeof param === 'object') {
        try {
          // Ensure object is JSON serializable
          return JSON.parse(JSON.stringify(param));
        } catch {
          return String(param);
        }
      }
      // Convert other unknown types to string as fallback
      return String(param);
    });
  }

  // Separate method to write audit log with proper error handling
  private static async writeAuditLog(
    auditEntry: AuditLogEntry,
    originalQuery: string
  ): Promise<void> {
    try {
      // Use a separate database connection to avoid conflicts
      const { db } = await import('./connection');

      const insertQuery = `
        INSERT INTO audit_logs (
          user_id, request_id, action, entity_type, entity_id, old_values,
          new_values, ip_address, user_agent, query_text, query_params,
          timestamp, duration_ms, success
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      const insertParams = [
        auditEntry.user_id,
        auditEntry.request_id,
        auditEntry.action,
        auditEntry.entity_type,
        auditEntry.entity_id,
        auditEntry.old_values ? JSON.stringify(auditEntry.old_values) : null,
        auditEntry.new_values ? JSON.stringify(auditEntry.new_values) : null,
        auditEntry.ip_address,
        auditEntry.user_agent,
        auditEntry.query_text,
        auditEntry.query_params
          ? JSON.stringify(auditEntry.query_params)
          : null,
        auditEntry.timestamp,
        auditEntry.duration_ms,
        auditEntry.success,
      ];

      await db.query(insertQuery, insertParams);
    } catch (error) {
      logger.error(
        {
          error,
          originalQuery: originalQuery.substring(0, 100),
          auditEntry: {
            ...auditEntry,
            query_text: originalQuery.substring(0, 100),
          },
        },
        'Failed to write audit log to database'
      );
      throw error;
    }
  }

  private static createAuditEntry(
    queryText: string,
    params?: unknown[],
    result?: QueryResult<QueryResultRow>,
    error?: Error,
    duration?: number
  ): AuditLogEntry {
    const action = this.extractAction(queryText);
    const entityType = this.extractEntityType(queryText);
    const entityId = this.extractEntityId(queryText, params);

    const context = this.getContext();

    return {
      user_id: context.userId ?? null,
      request_id: context.requestId ?? null,
      action: context.action || action,
      entity_type: context.entityType || entityType,
      entity_id: context.entityId ?? entityId ?? null,
      old_values: this.extractOldValues(queryText, params) ?? null,
      new_values: this.extractNewValues(queryText, params, result) ?? null,
      ip_address: context.ipAddress || 'unknown',
      user_agent: context.userAgent || null,
      query_text: queryText,
      query_params: params ? this.sanitizeParams(params) : null,
      timestamp: new Date(),
      duration_ms: duration ?? null,
      success: !error,
    };
  }

  private static extractAction(queryText: string): string {
    const query = queryText.toLowerCase().trim();

    if (query.startsWith('insert')) return 'CREATE';
    if (query.startsWith('update')) return 'UPDATE';
    if (query.startsWith('delete')) return 'DELETE';
    if (query.startsWith('select')) return 'READ';
    if (query.startsWith('alter')) return 'ALTER';
    if (query.startsWith('create')) return 'CREATE_SCHEMA';
    if (query.startsWith('drop')) return 'DROP_SCHEMA';

    return 'UNKNOWN';
  }

  private static extractEntityType(queryText: string): string {
    const query = queryText.toLowerCase();

    // Common patterns to extract table name
    const patterns = [
      /(?:from|into|update|join)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:insert\s+into)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:delete\s+from)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:alter\s+table)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:create\s+table)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:drop\s+table)\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match?.[1]) {
        return match[1].toUpperCase();
      }
    }

    return 'UNKNOWN';
  }

  private static extractEntityId(
    queryText: string,
    params?: unknown[]
  ): string | null {
    const query = queryText.toLowerCase();

    // Look for WHERE id = pattern
    const idPattern = /where\s+(?:.*\.)?id\s*=\s*\$(\d+)/i;
    const match = query.match(idPattern);

    if (match?.[1] && params) {
      const paramIndex = parseInt(match[1]) - 1;
      if (paramIndex >= 0 && paramIndex < params.length) {
        return String(params[paramIndex]);
      }
    }

    // Look for WHERE identifier = pattern (for app_configs, etc.)
    const identifierPattern = /where\s+(?:.*\.)?identifier\s*=\s*\$(\d+)/i;
    const identifierMatch = query.match(identifierPattern);

    if (identifierMatch?.[1] && params) {
      const paramIndex = parseInt(identifierMatch[1]) - 1;
      if (paramIndex >= 0 && paramIndex < params.length) {
        return String(params[paramIndex]);
      }
    }

    // Look for other common identifier fields
    const commonIdPatterns = [
      /where\s+(?:.*\.)?uuid\s*=\s*\$(\d+)/i,
      /where\s+(?:.*\.)?code\s*=\s*\$(\d+)/i,
      /where\s+(?:.*\.)?slug\s*=\s*\$(\d+)/i,
      /where\s+(?:.*\.)?name\s*=\s*\$(\d+)/i,
    ];

    for (const pattern of commonIdPatterns) {
      const patternMatch = query.match(pattern);
      if (patternMatch?.[1] && params) {
        const paramIndex = parseInt(patternMatch[1]) - 1;
        if (paramIndex >= 0 && paramIndex < params.length) {
          return String(params[paramIndex]);
        }
      }
    }

    // Look for direct ID values in WHERE clauses
    const directIdPattern = /where\s+(?:.*\.)?id\s*=\s*(\d+)/i;
    const directMatch = query.match(directIdPattern);

    if (directMatch?.[1]) {
      return directMatch[1];
    }

    return null;
  }

  private static extractOldValues(
    queryText: string,
    _params?: unknown[]
  ): Record<string, any> | undefined {
    const query = queryText.toLowerCase();

    // For UPDATE queries, we should capture the WHERE conditions as old values context
    if (query.startsWith('update')) {
      const whereMatch = query.match(
        /where\s+(.+?)(?:\s+(?:returning|order|limit|group)|$)/i
      );
      if (whereMatch) {
        return { where_clause: whereMatch[1] };
      }
    }

    // For DELETE queries, capture what's being deleted
    if (query.startsWith('delete')) {
      const whereMatch = query.match(
        /where\s+(.+?)(?:\s+(?:returning|order|limit|group)|$)/i
      );
      if (whereMatch) {
        return { deleted_where: whereMatch[1] };
      }
    }

    return undefined;
  }

  private static extractNewValues(
    queryText: string,
    params?: unknown[],
    result?: QueryResult<QueryResultRow>
  ): Record<string, any> | undefined {
    const query = queryText.toLowerCase();

    // For INSERT queries, try to extract the values
    if (query.startsWith('insert')) {
      const valuesMatch = query.match(/values\s*\(([^)]+)\)/i);
      if (valuesMatch && params) {
        return { inserted_values: params };
      }

      // For RETURNING queries, limit captured data to prevent storage bloat
      if (result && result.rows.length > 0) {
        const capturedRows = result.rows.slice(0, this.MAX_CAPTURED_ROWS);
        return {
          returned_data: capturedRows,
          total_rows: result.rows.length,
          truncated: result.rows.length > this.MAX_CAPTURED_ROWS,
        };
      }
    }

    // For UPDATE queries, extract SET values
    if (query.startsWith('update')) {
      const setMatch = query.match(/set\s+(.+?)\s+where/i);
      if (setMatch) {
        return { updated_fields: setMatch[1] };
      }
    }

    return undefined;
  }
}
