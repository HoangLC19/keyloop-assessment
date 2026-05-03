# ADR-001: Double-Booking Prevention via PostgreSQL Exclusion Constraints

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The core invariant of the scheduler is that no two confirmed appointments can share the same service bay or technician at an overlapping time. This must hold even when multiple requests arrive concurrently for the same slot.

Three common approaches exist:

1. **Application-level check-then-insert** — query for conflicts, then insert if none found
2. **`SELECT FOR UPDATE` / serializable isolation** — lock rows or escalate transaction isolation
3. **Database exclusion constraints** — enforce the invariant at the storage layer

The naive check-then-insert (approach 1) has a classic TOCTOU race: two concurrent requests both pass the availability check before either commits, resulting in a double-booking.

## Decision

Use PostgreSQL `btree_gist` exclusion constraints to enforce overlap prevention at the database level:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT no_bay_overlap EXCLUDE USING gist (
    service_bay_id WITH =,
    tsrange(start_time, end_time) WITH &&
  ) WHERE (status = 'CONFIRMED'),
  ADD CONSTRAINT no_technician_overlap EXCLUDE USING gist (
    technician_id WITH =,
    tsrange(start_time, end_time) WITH &&
  ) WHERE (status = 'CONFIRMED');
```

Any INSERT or UPDATE that would create an overlap is rejected by the database with `SQLSTATE 23P01` (`exclusion_violation`), which the error handler converts to `409 Conflict`.

## Alternatives Considered

### `SELECT FOR UPDATE`

Locks the relevant rows during the transaction. Prevents the race but requires careful scope — locking the wrong rows causes unnecessary serialisation, and locking too few rows misses the race. Also doesn't survive application crashes mid-transaction and adds latency under high concurrency.

### Serializable transaction isolation

Prevents all phantom reads. Effective but causes significantly more transaction aborts under contention (PostgreSQL uses predicate locking which generates many spurious conflicts). Requires retry logic in the application.

### Unique constraint on a pre-computed time bucket

Discretising time into fixed slots (e.g. 30-minute buckets) and using a unique constraint works but breaks for variable-duration service types and creates artificial alignment requirements.

## Consequences

- **Correctness guaranteed at the DB layer** — no application-level race can produce a double-booking, even under concurrent load.
- **Partial conflict on cancellation** — the `WHERE (status = 'CONFIRMED')` predicate means cancelled appointments do not block the slot, so rescheduling and cancellation work correctly without removing the constraint.
- **`btree_gist` extension required** — standard on managed Postgres (RDS, Cloud SQL, Supabase). Must be created before the migration runs.
- **`23P01` is not `23505`** — the error code for exclusion violations differs from unique violations. The error handler must check for `23P01` explicitly, and Prisma surfaces it differently depending on whether the violation comes from an ORM call (`PrismaClientUnknownRequestError`) or a raw query (`PrismaClientKnownRequestError` with `meta.code`). Both paths are handled.
