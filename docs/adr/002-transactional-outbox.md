# ADR-002: Transactional Outbox for Webhook and Email Notifications

**Status:** Accepted  
**Date:** 2026-05-01

## Context

When an appointment is confirmed, cancelled, or rescheduled, the system must notify the customer via email and fire any registered webhooks. The notification must be reliable: it should never be lost, and it should not fire if the appointment transaction rolls back.

Two naive approaches fail on reliability:

1. **Synchronous delivery inside the transaction** — call the email/webhook endpoint before committing. If delivery fails, the booking fails. External latency bleeds into booking latency. If the DB commits but the in-process call fails after commit, the event is lost.
2. **Fire-and-forget after commit** — call the endpoint after the transaction returns. If the process crashes between commit and the call, the event is silently dropped.

## Decision

Use the **transactional outbox pattern**: write the event to an `outbox` table atomically inside the same transaction as the appointment mutation. A separate background worker reads and delivers pending events.

```
Appointment transaction:
  INSERT INTO appointments ...
  INSERT INTO outbox (event_type, payload) VALUES ('appointment.confirmed', {...})
  COMMIT  ← both rows land atomically

Outbox worker (polling every 5s):
  SELECT ... FOR UPDATE SKIP LOCKED  ← claim a batch
  deliver via HTTP / SMTP
  UPDATE outbox SET status = 'DELIVERED'
```

`SELECT FOR UPDATE SKIP LOCKED` ensures multiple worker instances never process the same row concurrently, making the pattern safe for horizontal scaling.

## Alternatives Considered

### Message broker (Redis Streams, RabbitMQ, Kafka)

Durable and scalable but introduces an external dependency that must be operated, monitored, and kept in sync with the DB. For this scope, the operational overhead outweighs the benefit. The outbox pattern achieves the same durability guarantee using only the existing Postgres instance.

### Synchronous delivery inside the transaction

Simple but couples booking latency to external service latency. A slow webhook endpoint would hold a DB transaction open. External call failures would roll back the booking — confusing for the customer.

### Background job queue (BullMQ, pg-boss)

A legitimate option and close to the outbox pattern. BullMQ requires Redis; pg-boss adds a separate schema and dependency. A hand-rolled outbox is ~100 lines and has no extra dependencies, which is proportionate to the scope of this service.

## Consequences

- **At-least-once delivery** — if the worker crashes after claiming but before marking delivered, the claim expires and the row is retried. Applications consuming webhooks should be idempotent.
- **Exponential backoff** — failed deliveries are retried with increasing delays (10s, 20s, 40s… capped at 1 hour). After 10 attempts the row is marked `FAILED` (dead-lettered) and requires manual intervention.
- **Outbox table grows** — delivered rows accumulate. A periodic cleanup job (not yet implemented) should archive or delete rows older than a retention window.
- **Worker is in-process** — the outbox worker runs inside the same Express process via `setInterval`. For production, extracting it to a separate process (or using pg-boss) would allow independent scaling and deployment.
