import { Queue } from 'bullmq';
import { getRedisConnection } from '../../config/redis';

export type BillReminderJobData = {
  billId: string;
  reminderType: 'H-7' | 'H-3' | 'H+1' | 'H+7';
};

export type ContractExpiryJobData = {
  contractId: string;
};

export const emailQueue = new Queue('email-notifications', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60 * 1000 },
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  },
});
