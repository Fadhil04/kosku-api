import { Queue } from 'bullmq';
import { getRedisConnection } from '../../config/redis';

export const schedulerQueue = new Queue('scheduled-tasks', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  },
});

export async function registerScheduledJobs() {
  // Implementation lives in the job scheduler setup; kept for compatibility
}
