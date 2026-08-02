import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../../config/redis';
import { processBillReminder } from '../processors/billReminder.processor';
import { processContractExpiry } from '../processors/contractExpiry.processor';

export const emailWorker = new Worker(
  'email-notifications',
  async (job: Job) => {
    switch (job.name) {
      case 'send-bill-reminder':
        await processBillReminder(job.data as any);
        break;
      case 'send-contract-expiry-notice':
        await processContractExpiry(job.data as any);
        break;
      default:
        console.warn(`Unknown email job: ${job.name}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);
