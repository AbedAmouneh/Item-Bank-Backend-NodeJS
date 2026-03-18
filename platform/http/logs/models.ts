export interface HttpLog {
  id: number;
  requestId: string;
  userId?: number;
  method: string;
  path: string;
  queryParams?: Record<string, any>;
  requestHeaders?: Record<string, any>;
  requestBody?: Record<string, any>;
  responseStatus: number;
  responseBody?: Record<string, any>;
  responseHeaders?: Record<string, any>;
  durationMs: number;
  ipAddress: string;
  userAgent?: string;
  errorMessage?: string;
  errorStack?: string;
  createdOn: Date;
}

export interface CreateHttpLogRequest {
  requestId: string;
  userId?: number;
  method: string;
  path: string;
  queryParams?: Record<string, any>;
  requestHeaders?: Record<string, any>;
  requestBody?: Record<string, any>;
  responseStatus: number;
  responseBody?: Record<string, any>;
  responseHeaders?: Record<string, any>;
  durationMs: number;
  ipAddress: string;
  userAgent?: string;
  errorMessage?: string;
  errorStack?: string;
}
