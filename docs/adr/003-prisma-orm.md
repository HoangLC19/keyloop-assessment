# ADR-003: Prisma as the Database Access Layer

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The service needs a database access layer that provides: type-safe queries, schema management with migrations, and the ability to drop to raw SQL when the ORM's query builder is insufficient (as required for exclusion constraint availability queries).

## Decision

Use **Prisma 6** as the primary ORM with `prisma migrate` for schema management. Raw SQL via `prisma.$queryRaw` and `prisma.$executeRaw` is used where Prisma's query builder cannot express the required query (range overlap checks, outbox claim CTE).

**Version pinned to 6.x** — Prisma 7 changed to a `prisma.config.ts` configuration format that is incompatible with this project's setup.

## Alternatives Considered

### Drizzle ORM

Type-safe and closer to raw SQL in its API. Excellent TypeScript inference. Less mature migration tooling at time of writing and a steeper learning curve for teams familiar with ActiveRecord-style ORMs. A strong alternative for a greenfield project with a TypeScript-first team.

### `pg` / `postgres.js` (raw SQL only)

Maximum control and no abstraction overhead. Requires hand-writing all queries and a separate migration tool (e.g. `node-pg-migrate`). Appropriate for performance-critical services or those with complex query patterns that ORMs handle poorly. The added boilerplate was not justified for this scope.

### TypeORM

Mature and widely used. Decorator-based schema definition couples the model to the ORM more tightly than Prisma's separate schema file. Active Record pattern encourages putting logic in models, which conflicts with the repository pattern used here.

## Consequences

- **Prisma schema is the source of truth** — all model changes go through `prisma/schema.prisma` and generate a timestamped migration file. This provides a full, auditable history of schema changes.
- **Exclusion constraints are outside Prisma's model** — Prisma does not support `EXCLUDE` constraints. They are appended as raw SQL at the end of the initial migration file. This means they are not reflected in the Prisma schema and must be maintained manually if the schema is regenerated.
- **`String @id` maps to `TEXT`** — Prisma's default ID type is `TEXT`, not `UUID`. Raw SQL queries must not cast these columns with `::uuid` or the query will fail with `operator does not exist: text = uuid`. Only columns explicitly annotated with `@db.Uuid` should use `::uuid` casts.
- **Prisma Client is generated** — `node_modules/@prisma/client` must be regenerated after schema changes via `prisma generate`. The `postinstall` hook handles this automatically.
