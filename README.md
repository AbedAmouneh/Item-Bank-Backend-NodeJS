# Backend API Template

A production-grade backend template built with Node.js, TypeScript, Fastify, and PostgreSQL.

## Features

- 🔐 **Authentication & Authorization**: JWT-based authentication with role-based access control (RBAC)
- 🛡️ **Security**: Helmet, CORS, rate limiting, request validation
- 📊 **Database**: PostgreSQL with connection pooling and transaction support
- 📝 **Logging**: Structured logging with Pino
- 🔄 **Type Safety**: Full TypeScript with strict type checking
- ⚡ **Performance**: Fastify framework for high performance
- 🔄 **Background Jobs**: Redis-based job queue system for async processing
- 🛡️ **CSRF Protection**: Cross-site request forgery protection
- 🐳 **Container Ready**: Docker support for easy deployment

## Prerequisites

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 12.0
- **Redis**: >= 6.0 (for sessions and job queues)
- **pnpm**: >= 8.0

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd item-bank
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure the following:
   - Database connection details
   - JWT secret (must be at least 32 characters)
   - Server port and host
   - CORS origins
   - Logging preferences

4. **Set up the database**
   ```bash
   # Run the SQL scripts in the tests/setup/tables/ directory
   psql -U your_user -d your_database -f tests/setup/tables/users.sql
   psql -U your_user -d your_database -f tests/setup/tables/user_sessions.sql
   psql -U your_user -d your_database -f tests/setup/tables/audit_logs.sql
   ```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

- `DATABASE_URL`: PostgreSQL connection string
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Database connection details
- `JWT_SECRET`: Secret key for JWT tokens (min 32 characters)
- `JWT_EXPIRES_IN`: Token expiration time (e.g., "7d", "24h")
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production, test)
- `LOG_LEVEL`: Logging level (trace, debug, info, warn, error, fatal)
- `CORS_ORIGIN`: Allowed CORS origins (comma-separated or "\*")
- `REDIS_URL`: Redis connection URL (optional, overrides host/port)
- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `COOKIE_SECRET`: Secret for signing cookies (falls back to JWT_SECRET if not provided)

## Development

1. **Start development server**

   ```bash
   pnpm dev
   ```

2. **Build for production**

   ```bash
   pnpm build
   ```

3. **Run production server**

   ```bash
   pnpm start
   ```

4. **Run background jobs processor**

   ```bash
   pnpm start:jobs
   ```

5. **Development with background jobs**

   ```bash
   pnpm dev:jobs
   ```

6. **Type checking**

   ```bash
   pnpm typecheck
   ```

7. **Linting**

   ```bash
   pnpm lint
   ```

8. **Format code**
   ```bash
   pnpm format
   ```

## Project Structure

```
item-bank/
├── controllers/          # Modular controllers (each with models/service/repository)
├── platform/             # HTTP, database, logging, middleware
├── routes/               # API route definitions
├── runmodes/             # App entry points (api/jobs)
├── services/             # Shared services
├── tests/
│   └── setup/            # Scripts, tables, fixtures
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── dist/                 # Compiled JavaScript (generated)
└── node_modules/         # Dependencies
```

## Roles

The template supports two roles:

- `admin`: Administrative access
- `user`: Standard user

Extend `ROLE_VALUES` in `types/common.ts` and add middleware as needed for your app.

## Background Jobs

The system includes a background job processor for handling asynchronous tasks:

- **Scheduled Jobs**: Periodic tasks like data aggregation, cleanup, etc.
- **On-Demand Jobs**: Queue-based processing for tasks triggered by user actions
- **Queue Management**: Redis-backed job queues with worker processes

Jobs are defined in `runmodes/jobs/config.ts` and processed by workers.

## Database Schema

Key tables:

- `users`: User accounts and profiles
- `user_sessions`: Active user sessions
- `audit_logs`: System audit trail

See `tests/setup/tables/` directory for complete schema.

## Security Features

- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: Configurable request rate limits
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Parameterized queries
- **CSRF Protection**: Cross-site request forgery protection for state-changing operations
- **Input Sanitization**: Automatic sanitization of user inputs
- **Security Headers**: HTTP security headers via Helmet

## Logging

Structured logging with Pino:

- Development: Pretty-printed logs
- Production: JSON logs
- Sensitive data automatically redacted

## Error Handling

All errors return a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Docker

The application includes a Dockerfile for containerized deployment:

```bash
# Build the image
docker build -t backend .

# Run the container
docker run -p 3000:3000 --env-file .env backend
```

Example `docker-compose.yml` with dependencies:

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: app_password

  redis:
    image: redis:7-alpine
```

## Health

- **GET `/health`**: Returns `200` with `{ "ok": true }`. Use for load balancers and orchestration readiness/liveness probes. Extend the handler if you need database or Redis checks.

## Development Tools

- **TypeScript**: Type-safe development
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Nodemon**: Auto-reload during development

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set strong `JWT_SECRET` (32+ characters)
4. Configure proper CORS origins
5. Set up reverse proxy (nginx, etc.)
6. Enable HTTPS
7. Set up monitoring and logging

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
