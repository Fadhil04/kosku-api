import { prisma } from '../../src/config/database';
import { schedulerQueue } from '../../src/jobs/queues/scheduler.queue';

// Mock BullMQ queue untuk testing
jest.mock('../../src/jobs/queues/scheduler.queue', () => ({
  schedulerQueue: {
    add: jest.fn().mockResolvedValue({ id: 'test-job-id-123' }),
  },
}));

describe('Admin Trigger (Integration)', () => {
  const mockSchedulerQueue = schedulerQueue as jest.Mocked<typeof schedulerQueue>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger bill reminders job', async () => {
    const result = await mockSchedulerQueue.add('check-bill-reminders', {});

    expect(mockSchedulerQueue.add).toHaveBeenCalledWith('check-bill-reminders', {});
    expect(result.id).toBe('test-job-id-123');
  });

  it('should trigger monthly bills generation job', async () => {
    const result = await mockSchedulerQueue.add('generate-monthly-bills', {});

    expect(mockSchedulerQueue.add).toHaveBeenCalledWith('generate-monthly-bills', {});
    expect(result.id).toBe('test-job-id-123');
  });

  it('should trigger expiring contracts check job', async () => {
    const result = await mockSchedulerQueue.add('check-expiring-contracts', {});

    expect(mockSchedulerQueue.add).toHaveBeenCalledWith('check-expiring-contracts', {});
    expect(result.id).toBe('test-job-id-123');
  });
});
