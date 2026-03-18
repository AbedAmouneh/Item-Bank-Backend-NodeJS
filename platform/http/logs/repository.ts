import { db } from '../../database/connection';
import { CreateHttpLogRequest, HttpLog } from './models';

export class HttpLogRepository {
  async createLog(data: CreateHttpLogRequest): Promise<void> {
    const query = `
      INSERT INTO http_logs (
        request_id, user_id, method, path, query_params,
        request_headers, request_body, response_status, response_body,
        response_headers, duration_ms, ip_address, user_agent,
        error_message, error_stack, created_on
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    `;

    const values = [
      data.requestId,
      data.userId || null,
      data.method,
      data.path,
      data.queryParams ? JSON.stringify(data.queryParams) : null,
      data.requestHeaders ? JSON.stringify(data.requestHeaders) : null,
      data.requestBody ? JSON.stringify(data.requestBody) : null,
      data.responseStatus,
      data.responseBody ? JSON.stringify(data.responseBody) : null,
      data.responseHeaders ? JSON.stringify(data.responseHeaders) : null,
      data.durationMs,
      data.ipAddress,
      data.userAgent || null,
      data.errorMessage || null,
      data.errorStack || null,
    ];

    db.query(query, values).catch(error => {
      console.error('Failed to write HTTP log:', error);
    });
  }

  async getErrorLogs(limit: number = 100): Promise<HttpLog[]> {
    const query = `
      SELECT * FROM http_logs
      WHERE response_status >= 400
      ORDER BY created_on DESC
      LIMIT $1
    `;

    const result = await db.query<HttpLog>(query, [limit]);
    return result.rows;
  }
}
