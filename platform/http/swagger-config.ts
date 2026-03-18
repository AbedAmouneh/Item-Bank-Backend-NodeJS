import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';

import packageJson from '../../package.json';
import { config } from '../../utils/config';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Backend API',
      version: packageJson.version,
      description: `
# API Documentation

REST API with JWT authentication. Extend routes and schemas for your application.

## Authentication

Most endpoints require authentication using JWT Bearer tokens:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

To obtain a token, use the \`POST /api/auth/login\` endpoint.

## Request IDs

All requests are assigned a unique request ID for tracing and debugging. The request ID is:
- Returned in the \`x-request-id\` response header
- Included in all log entries
- Included in error responses for support tickets

## Idempotency

Critical operations may support idempotency to prevent duplicate submissions:

\`\`\`
Idempotency-Key: <unique_key>
\`\`\`

If the same key is used again within 24 hours, the original response will be returned.

## Rate Limiting

API requests are rate-limited to ${config.security.rateLimit.max} requests per ${config.security.rateLimit.window}ms per IP address.

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "requestId": "abc123...",
    "details": {}
  }
}
\`\`\`

## Common Error Codes

- \`VALIDATION_ERROR\` - Invalid request data (400)
- \`UNAUTHORIZED\` - Missing or invalid authentication (401)
- \`FORBIDDEN\` - Insufficient permissions (403)
- \`NOT_FOUND\` - Resource not found (404)
- \`RATE_LIMIT_EXCEEDED\` - Too many requests (429)
- \`INTERNAL_ERROR\` - Server error (500)
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              const: false,
              example: false,
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                  description: 'Machine-readable error code',
                },
                message: {
                  type: 'string',
                  example: 'Invalid request data',
                  description: 'Human-readable error message',
                },
                requestId: {
                  type: 'string',
                  example: 'abc123def456',
                  description: 'Request ID for debugging and support',
                },
                details: {
                  type: 'object',
                  description:
                    'Additional error details (validation errors, etc.)',
                },
              },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: {
              type: 'boolean',
              const: true,
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response payload',
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
};

export const swaggerUIConfig = {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list' as const,
    deepLinking: false,
  },
  staticCSP: true,
  transformSpecificationClone: true,
};
