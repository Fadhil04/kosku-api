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

emailWorker.on('completed', (job) => {
  console.log(`Email job completed: ${job.name} (${job.id})`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job failed: ${job?.name} (${job?.id})`, err?.message || err);
});

emailWorker.on('error', (err) => {
  console.error('Email worker error:', err);
});
