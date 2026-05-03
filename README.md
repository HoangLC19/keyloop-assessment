# Keyloop Technical Assessment — Unified Service Scheduler

A backend REST API for scheduling vehicle service appointments at dealerships, with real-time resource constraint checking and webhook notifications.

**Stack:** Node.js · TypeScript · PostgreSQL · Docker  
**Test suite:** 23 unit + 18 integration tests

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.18 |
| pnpm | ≥ 11 |
| Docker & Docker Compose | any recent version |

## Setup

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure environment**

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Minimum required variables:

```env
DATABASE_URL=postgresql://keyloop:keyloop@localhost:5432/keyloop
JWT_SECRET=change-me-in-production
```

**3. Start Postgres**

```bash
docker compose up -d
```

This starts two containers:
- `db` — main database on port `5432`
- `db-test` — isolated test database on port `5433`

**4. Run migrations**

```bash
pnpm exec prisma migrate deploy
```

**5. Start the dev server**

```bash
pnpm dev
```

The API is available at `http://localhost:3000`.

---

## Commands

```bash
pnpm dev          # Start dev server with hot reload (tsx watch)
pnpm build        # Compile TypeScript → dist/
pnpm start        # Run compiled output
pnpm test         # All tests (unit + integration) — requires Docker
pnpm test:unit    # Unit tests only (no DB required)
pnpm test:int     # Integration tests only (requires Docker)
pnpm lint         # Type-check with tsc --noEmit
```

---

## API Overview

All endpoints require a `Bearer` JWT token except `/auth/*`.

### Auth

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register as CUSTOMER or ADMIN |
| POST | `/auth/login` | — | Get a JWT token |

### Admin (ADMIN role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/dealerships` | Create a dealership |
| POST | `/admin/dealerships/:id/bays` | Add a service bay |
| POST | `/admin/dealerships/:id/technicians` | Add a technician |
| POST | `/admin/technicians/:id/certifications` | Certify a technician for a service type |
| DELETE | `/admin/technicians/:id/certifications/:serviceTypeId` | Remove certification |
| POST | `/admin/service-types` | Create a service type |
| GET | `/admin/service-types` | List service types |

### Appointments (CUSTOMER role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/appointments` | Book an appointment |
| GET | `/api/appointments` | List own appointments |
| GET | `/api/appointments/:id` | Get appointment detail |
| PATCH | `/api/appointments/:id/cancel` | Cancel an appointment |
| PATCH | `/api/appointments/:id/reschedule` | Reschedule to a new time |
| GET | `/api/appointments/availability` | Query available slots |

### Webhooks (CUSTOMER role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks` | Subscribe to appointment events |
| GET | `/api/webhooks` | List own subscriptions |
| DELETE | `/api/webhooks/:id` | Unsubscribe |

---

## Architecture

### Request flow

```mermaid
flowchart LR
    Client -->|HTTP| Router
    Router -->|Zod validation| Service
    Service -->|query / mutate| Repository
    Repository -->|Prisma / raw SQL| DB[(PostgreSQL)]

    subgraph Layers
        Router
        Service
        Repository
    end
```

**Modules:**

```
src/
  modules/
    auth/           — JWT sign/verify, bcrypt, requireAuth/requireRole middleware
    appointments/   — booking lifecycle, availability queries, reschedule
    resources/      — admin CRUD for dealerships, bays, technicians, service types
    notifications/  — transactional outbox worker, email + webhook delivery
    webhooks/       — webhook subscription CRUD, SSRF-safe URL validation
  shared/
    db/             — Prisma client singleton
    errors/         — typed error classes (400/401/403/404/409)
```

### Booking flow

```mermaid
sequenceDiagram
    actor Customer
    participant API
    participant AppointmentService
    participant DB as PostgreSQL

    Customer->>API: POST /api/appointments
    API->>AppointmentService: book(vehicleId, dealershipId, serviceTypeId, startTime)

    AppointmentService->>DB: find available bay (raw SQL, no ::uuid cast)
    DB-->>AppointmentService: bay | null

    AppointmentService->>DB: find available technician (raw SQL)
    DB-->>AppointmentService: technician | null

    alt no bay or no technician
        AppointmentService-->>API: 409 Conflict
        API-->>Customer: 409 No resource available
    else both free
        AppointmentService->>DB: BEGIN TRANSACTION
        AppointmentService->>DB: INSERT appointment (status=CONFIRMED)
        AppointmentService->>DB: INSERT outbox row (appointment.confirmed)
        AppointmentService->>DB: COMMIT

        note over DB: btree_gist exclusion constraint<br/>rejects concurrent overlap → 23P01

        DB-->>AppointmentService: appointment record
        AppointmentService-->>API: appointment
        API-->>Customer: 201 Created
    end
```

### Notification flow (transactional outbox)

```mermaid
flowchart TD
    TX[Appointment transaction] -->|atomically writes| OB[(outbox table)]

    OB -->|SELECT FOR UPDATE\nSKIP LOCKED| W[Outbox Worker]

    W --> Email[Email delivery\nnodemailer]
    W --> WH[Webhook delivery\nHTTPS POST + HMAC]

    Email -->|success| S1[mark delivered]
    WH -->|success| S2[mark delivered]

    Email -->|failure| R1[exponential backoff\nmax 10 retries]
    WH -->|failure| R2[exponential backoff\nmax 10 retries]

    R1 -->|attempts > 10| DL[dead-letter\nstatus=FAILED]
    R2 -->|attempts > 10| DL
```

### Double-booking prevention

Availability checks and appointment creation are enforced at the database level using PostgreSQL `btree_gist` exclusion constraints:

```sql
-- No two CONFIRMED appointments can overlap on the same bay or technician
ADD CONSTRAINT no_bay_overlap EXCLUDE USING gist (
  service_bay_id WITH =, tsrange(start_time, end_time) WITH &&
) WHERE (status = 'CONFIRMED');

ADD CONSTRAINT no_technician_overlap EXCLUDE USING gist (
  technician_id WITH =, tsrange(start_time, end_time) WITH &&
) WHERE (status = 'CONFIRMED');
```

Concurrent requests that pass the application-level availability check still can't double-book — the DB raises `SQLSTATE 23P01` which the error handler converts to a `409 Conflict`.

### Transactional outbox

Webhook and email notifications are delivered via an outbox pattern: appointment events are written atomically to an `outbox` table inside the same transaction as the appointment mutation. A background worker claims rows with `SELECT FOR UPDATE SKIP LOCKED`, attempts delivery, and applies exponential backoff on failure (max 10 retries before dead-lettering).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | Token TTL (default: `7d`) |
| `PORT` | No | HTTP port (default: `3000`) |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `OUTBOX_INTERVAL_MS` | No | Outbox poll interval (default: `5000`) |
