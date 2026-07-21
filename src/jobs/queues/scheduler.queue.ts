import { Queue } from 'bullmq';
import { env } from '../../config/env';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};

export const schedulerQueue = new Queue('scheduled-tasks', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  },
});

/**
 * Daftarkan semua scheduled job yang berjalan repeat otomatis.
 * Dipanggil sekali saat aplikasi startup.
 */
export async function registerScheduledJobs() {
  // Generate tagihan bulanan — tiap tanggal 25 jam 02:00
  await schedulerQueue.add(
    'generate-monthly-bills',
    {},
    {
      repeat: { pattern: '0 2 25 * *' }, // cron: menit jam tanggal bulan hari
      jobId: 'generate-monthly-bills-recurring',
    },
  );

  // Cek bill yang perlu reminder — tiap hari jam 08:00
  await schedulerQueue.add(
    'check-bill-reminders',
    {},
    {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'check-bill-reminders-recurring',
    },
  );

  // Cek kontrak yang akan expire — tiap hari jam 09:00
  await schedulerQueue.add(
    'check-expiring-contracts',
    {},
    {
      repeat: { pattern: '0 9 * * *' },
      jobId: 'check-expiring-contracts-recurring',
    },
  );

  console.log('Scheduled jobs berhasil didaftarkan');
}