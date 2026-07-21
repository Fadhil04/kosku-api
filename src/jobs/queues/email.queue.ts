import { Queue } from 'bullmq';
import { env } from '../../config/env';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};

export interface BillReminderJobData {
  billId: string;
  reminderType: 'H-7' | 'H-3' | 'H+1' | 'H+7';
}

export interface ContractExpiryJobData {
  contractId: string;
}

export interface PaymentConfirmationJobData {
  paymentId: string;
}

export const emailQueue = new Queue('email-notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60 * 1000, // mulai dari 1 menit, lalu 5 menit, lalu 15 menit
    },
    removeOnComplete: { age: 7 * 24 * 60 * 60 }, // simpan 7 hari lalu hapus
    removeOnFail: { age: 30 * 24 * 60 * 60 }, // simpan job gagal 30 hari untuk investigasi
  },
});