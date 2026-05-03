import { randomUUID } from 'crypto';
import { outboxRepository } from './outbox.repository';
import { processOutboxEvent } from './notifications.service';

const WORKER_ID = randomUUID();

async function poll(): Promise<void> {
  const rows = await outboxRepository.claim(WORKER_ID);
  await Promise.allSettled(
    rows.map(async (row) => {
      let delivered = false;
      try {
        await processOutboxEvent(row);
        delivered = true;
        await outboxRepository.markProcessed(row.id, row.claimToken);
      } catch (err) {
        if (delivered) {
          // Delivery succeeded but markProcessed threw — log and leave locked so
          // the lock timeout reclaims it. Do not call markFailed (would re-queue).
          console.error(`Outbox mark-processed failed for ${row.id} (already delivered):`, err);
          return;
        }
        console.error(`Outbox delivery failed for ${row.id}:`, err);
        await outboxRepository.markFailed(row.id, row.claimToken, row.attempts);
      }
    })
  );
}

export function startOutboxWorker(): void {
  setInterval(() => poll().catch((e) => console.error('Outbox poll error:', e)), 5000);
  console.log(`Outbox worker started (id=${WORKER_ID})`);
}
