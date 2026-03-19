# Item Bank Backend — Claude Code Instructions

## Who is reading this code

The developer working on this project is learning backend development.
They have a frontend background but limited backend experience.

---

## Teaching rule — ALWAYS follow this

Before writing or editing any file, explain what you are about to do in
plain English. Keep it short — 2 to 4 sentences maximum. Use a simple
analogy if the concept is abstract. Then write the code.

After finishing a file, add one sentence saying what role it plays in the
bigger picture (e.g. "This is the repository — it is the only file that
is allowed to talk to the database directly.").

**Never use a technical term without explaining it the first time it appears.**

Example of the format to follow:

> "I'm about to create the service file. Think of it as the brain — it
> makes decisions and applies business rules, but it never talks to the
> database directly. It delegates that job to the repository."
> [writes the code]
> "This service sits between the handler (which receives the HTTP request)
> and the repository (which runs the SQL query)."

---

## Project conventions

- Runtime: Node.js with TypeScript (strict mode)
- Framework: Fastify
- Database: PostgreSQL via `pg` (no ORM — raw SQL queries)
- Cache: Redis via `ioredis`
- Validation: Zod
- Auth: JWT in httpOnly cookies + CSRF tokens
- Package manager: pnpm — never use npm or yarn
- All controllers follow the pattern: handler → service → repository

## Folder structure

```
controllers/<name>/
  handlers/       ← receives the HTTP request, validates input, sends response
  service/        ← business logic, rules, decisions
  repository/     ← all SQL queries, only file that touches the DB
  models/         ← Zod schemas and TypeScript types
  index.ts        ← registers the routes

platform/         ← shared infrastructure (server setup, middleware, DB pool)
utils/            ← shared helper functions
types/            ← shared TypeScript interfaces
routes/           ← assembles all controllers into the app
```

## Commit Messages

**Imperative short** format — no conventional prefix:

```
Add questions repository
Fix login error response shape
Remove duplicate import in auth handler
```

No `feat:`, `fix:`, `chore:` prefixes.

**Atomic commits — one commit per file or logical unit.** Never batch multiple
files into a single commit. Each new file, each bug fix, and each migration
gets its own commit.

---

## Branching

- Commit directly to `main` — no feature branches needed

---

## Commit Rules

- Never commit `.md` files — documentation and notes stay out of version control
- Exception: `CLAUDE.md` itself is the only `.md` file that may be committed
- Never add `Co-Authored-By` trailers to commit messages — keep Abed as the sole author

## Code style

- No implicit `any`, no `@ts-ignore`, no `as unknown as X` casts
- Always fix type errors properly
- Remove all console.log before finishing a task
- No TODO or FIXME comments — either implement it or don't

## After every task

Run `pnpm typecheck` to confirm no TypeScript errors.
If the task involves a new route, also run `pnpm build` to verify nothing broke.
