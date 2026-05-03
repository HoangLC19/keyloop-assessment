import { randomUUID } from 'crypto';
import prisma from '../../shared/db/client';

export interface OutboxRow {
  id: string;
  eventType: string;
  payload: unknown;
  claimToken: string;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export const outboxRepository = {
  claim: (workerId: string): Promise<OutboxRow[]> =>
    prisma.$queryRaw<OutboxRow[]>`
      WITH candidates AS (
        SELECT id FROM outbox
        WHERE processed_at    IS NULL
          AND dead_lettered_at IS NULL
          AND next_attempt_at <= NOW()
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '60 seconds')
        ORDER BY created_at
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox
      SET locked_at   = NOW(),
          locked_by   = ${workerId},
          claim_token = ${randomUUID()}::uuid,
          attempts    = attempts + 1
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING
        outbox.id,
        outbox.event_type   AS "eventType",
        outbox.payload,
        outbox.claim_token::text AS "claimToken",
        outbox.attempts
    `,

  markProcessed: (id: string, claimToken: string) =>
    prisma.$executeRaw`
      UPDATE outbox
      SET processed_at = NOW(), locked_at = NULL, locked_by = NULL, claim_token = NULL
      WHERE id = ${id} AND claim_token = ${claimToken}::uuid
    `,

  markFailed: async (id: string, claimToken: string, attempts: number) => {
    if (attempts >= MAX_ATTEMPTS) {
      await prisma.$executeRaw`
        UPDATE outbox
        SET dead_lettered_at = NOW(), locked_at = NULL, locked_by = NULL, claim_token = NULL
        WHERE id = ${id} AND claim_token = ${claimToken}::uuid
      `;
    } else {
      const backoffSec = Math.min(10 * Math.pow(2, attempts), 3600);
      await prisma.$executeRaw`
        UPDATE outbox
        SET locked_at       = NULL,
            locked_by       = NULL,
            claim_token     = NULL,
            next_attempt_at = NOW() + (${backoffSec} * INTERVAL '1 second')
        WHERE id = ${id} AND claim_token = ${claimToken}::uuid
      `;
    }
  },
};
