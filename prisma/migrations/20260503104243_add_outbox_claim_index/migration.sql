-- CreateIndex
CREATE INDEX "outbox_processed_at_dead_lettered_at_next_attempt_at_idx" ON "outbox"("processed_at", "dead_lettered_at", "next_attempt_at");
