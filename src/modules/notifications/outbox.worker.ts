import { randomUUID } from 'crypto';
import { outboxRepository } from './outbox.repository';
import { processOutboxEvent } from './notifications.service';

const WORKER_ID = randomUUID();

async function poll(): Promise<void> {
  const rows = await outboxRepository.claim(WORKER_ID);
  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await processOutboxEvent(row);
        await outboxRepository.markProcessed(row.id, row.claimToken);
      } catch (err) {
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
