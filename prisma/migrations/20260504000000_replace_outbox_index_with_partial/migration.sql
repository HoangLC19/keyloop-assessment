-- Replace three-column composite index with a partial index covering only live,
-- unprocessed rows — far more selective for the hot claim query.
DROP INDEX "outbox_processed_at_dead_lettered_at_next_attempt_at_idx";
CREATE INDEX outbox_claim_idx ON outbox(next_attempt_at)
  WHERE processed_at IS NULL AND dead_lettered_at IS NULL;
