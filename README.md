# Keyloop Technical Assessment — Scenario A: Unified Service Scheduler

## Overview

A backend service for scheduling vehicle service appointments at dealerships, with real-time resource constraint checking (service bays + technician availability).

Built as part of the Keyloop Technical Assessment. AI-assisted development (Claude Code, Cursor) is a first-class part of the workflow.

## Scenario

**Domain:** Ownership

**Problem:** Replace manual booking systems with an automated scheduler that enforces resource constraints before confirming appointments.

**Core requirements:**
1. **Resource-Constrained Booking** — A user requests an appointment for a specific vehicle, service type, and dealership at a desired time.
2. **Real-Time Availability Check** — Before confirming, the system checks that both a ServiceBay and a qualified Technician are free for the full service duration.
3. **Confirmed Appointment Record** — On success, persist an Appointment record linking customer, vehicle, technician, and service bay.

## Approach

- **Layer:** Backend only (REST API + persistent database)
- **Frontend:** Mocked via cURL examples / OpenAPI spec
- **Stack:** Node.js (TypeScript), PostgreSQL, Docker
- **AI Tools:** Claude Code, Cursor

## Status

> Work in progress — system design and implementation in progress.

## Structure (planned)

```
keyloop-assessment/
├── docs/           # System design document + architecture diagram
├── src/            # Application source code
├── tests/          # Unit + integration tests
├── docker-compose.yml
└── README.md
```
