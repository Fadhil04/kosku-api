import { Worker, Job } from 'bullmq';
import { env } from '../../config/env';
import { processBillReminder } from '../processors/billReminder.processor';
import { processContractExpiry } from '../processors/contractExpiry.processor';
import type {
  BillReminderJobData,
  ContractExpiryJobData,
} from '../queues/email.queue';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};

export const emailWorker = new Worker(
  'email-notifications',
  async (job: Job) => {
    console.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case 'send-bill-reminder':
        return await processBillReminder(job.data as BillReminderJobData);

      case 'send-contract-expiry-notice':
        return await processContractExpiry(job.data as ContractExpiryJobData);

      default:
        console.warn(`Job type tidak dikenal: ${job.name}`);
        return { skipped: true, reason: 'unknown_job_type' };
    }
  },
  {
    connection,
    concurrency: 5, // proses maksimal 5 email bersamaan
  },
);

emailWorker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} (${job.name}) selesai`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} (${job?.name}) gagal:`, err.message);
});