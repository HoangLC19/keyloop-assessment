jest.mock('../../src/modules/notifications/outbox.repository', () => ({
  outboxRepository: {
    claim: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  },
  MAX_ATTEMPTS: 5,
  calcBackoffSec: jest.requireActual('../../src/modules/notifications/outbox.repository').calcBackoffSec,
}));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  processOutboxEvent: jest.fn(),
}));

import { poll } from '../../src/modules/notifications/outbox.worker';
import { outboxRepository, calcBackoffSec } from '../../src/modules/notifications/outbox.repository';
import { processOutboxEvent } from '../../src/modules/notifications/notifications.service';

const mockRepo = outboxRepository as jest.Mocked<typeof outboxRepository>;
const mockProcess = processOutboxEvent as jest.MockedFunction<typeof processOutboxEvent>;

const makeRow = (attempts = 1) => ({
  id: 'row-1',
  eventType: 'APPOINTMENT_CREATED',
  payload: {},
  claimToken: 'token-abc',
  attempts,
});

beforeEach(() => jest.clearAllMocks());

describe('poll — delivery failure', () => {
  it('calls markFailed when processOutboxEvent throws', async () => {
    const row = makeRow(1);
    mockRepo.claim.mockResolvedValue([row]);
    mockProcess.mockRejectedValue(new Error('network error'));

    await poll();

    expect(mockRepo.markFailed).toHaveBeenCalledWith(row.id, row.claimToken, row.attempts);
    expect(mockRepo.markProcessed).not.toHaveBeenCalled();
  });
});

describe('poll — delivered=true, markProcessed fails', () => {
  it('calls markFailed (not silent bail) so row gets proper backoff/dead-lettering', async () => {
    const row = makeRow(1);
    mockRepo.claim.mockResolvedValue([row]);
    mockProcess.mockResolvedValue(undefined);
    mockRepo.markProcessed.mockRejectedValue(new Error('db gone'));

    await poll();

    expect(mockRepo.markFailed).toHaveBeenCalledWith(row.id, row.claimToken, row.attempts);
  });

  it('calls markFailed with correct attempts when near max', async () => {
    const row = makeRow(5);
    mockRepo.claim.mockResolvedValue([row]);
    mockProcess.mockResolvedValue(undefined);
    mockRepo.markProcessed.mockRejectedValue(new Error('db gone'));

    await poll();

    expect(mockRepo.markFailed).toHaveBeenCalledWith(row.id, row.claimToken, 5);
  });
});

describe('poll — happy path', () => {
  it('calls markProcessed and no markFailed on success', async () => {
    const row = makeRow(1);
    mockRepo.claim.mockResolvedValue([row]);
    mockProcess.mockResolvedValue(undefined);
    mockRepo.markProcessed.mockResolvedValue(1 as any);

    await poll();

    expect(mockRepo.markProcessed).toHaveBeenCalledWith(row.id, row.claimToken);
    expect(mockRepo.markFailed).not.toHaveBeenCalled();
  });
});

describe('calcBackoffSec', () => {
  it('returns 10s for attempts=0 (defensive guard)', () => {
    expect(calcBackoffSec(0)).toBe(10);
  });

  it('returns 10s for attempts=1 (first retry)', () => {
    expect(calcBackoffSec(1)).toBe(10);
  });

  it('returns 20s for attempts=2', () => {
    expect(calcBackoffSec(2)).toBe(20);
  });

  it('returns 40s for attempts=3', () => {
    expect(calcBackoffSec(3)).toBe(40);
  });

  it('caps at 3600s for very large attempts', () => {
    expect(calcBackoffSec(100)).toBe(3600);
  });
});
