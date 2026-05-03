# ADR-004: Modular Monolith Architecture

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The service needs an architectural style that is simple to develop, test, and deploy at assessment scale, while remaining structured enough to be extended or split later. The domain has clear bounded contexts: authentication, resource management, appointment booking, and notifications.

## Decision

Use a **modular monolith**: a single Express application and a single PostgreSQL database, with the codebase divided into feature modules that enforce internal boundaries.

```
src/modules/
  auth/           — JWT issuance, password hashing, middleware
  appointments/   — booking lifecycle, availability queries
  resources/      — dealership supply-side CRUD
  notifications/  — outbox worker, email and webhook delivery
  webhooks/       — subscription management, SSRF validation
src/shared/
  db/             — single Prisma client singleton
  errors/         — typed error classes
```

Each module owns its router, service, and repository. Cross-module communication goes through service calls, not direct DB access from another module's repository.

## Alternatives Considered

### Microservices

Each bounded context as a separate deployable service. Enables independent scaling and deployment but introduces significant overhead: inter-service communication (HTTP or message broker), distributed tracing, separate CI pipelines, and network latency on every cross-service call. The domain is not complex enough to justify this at current scale, and microservices are harder to develop and test locally.

### Flat structure (no modules)

All files in `src/` without subdirectories. Fast to start but does not scale — as the codebase grows, understanding which code belongs to which domain becomes difficult and cross-cutting concerns bleed across the codebase.

### Domain-Driven Design with strict aggregate boundaries

Full DDD with aggregates, domain events, and application/domain/infrastructure layers. Valuable for complex domains with many collaborating developers. Significantly more ceremony than the domain complexity warrants here.

## Consequences

- **Single deployment unit** — one Docker image, one database, one process to monitor. Straightforward for CI/CD and local development.
- **Shared database** — all modules share one Postgres instance and one Prisma client. This is a deliberate trade-off: it allows atomic cross-module transactions (appointment + outbox in one transaction) at the cost of tighter data coupling between modules.
- **Module boundaries are by convention** — nothing technically prevents one module's repository from querying another module's table. Discipline is required to maintain boundaries as the codebase grows.
- **Extractable to microservices** — because each module has a clear interface (router → service → repository), any module can be extracted into its own service in the future. The notifications module is the most natural candidate for extraction given it has independent scaling needs.
