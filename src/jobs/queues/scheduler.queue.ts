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

/**
 * Daftarkan recurring jobs.
 * Dipanggil sekali saat worker.ts startup.
 *
 * Semua job pakai cron timezone Asia/Jakarta.
 * - generate-monthly-bills  : setiap hari ke-1 pukul 01.00
 * - check-bill-reminders    : setiap hari pukul 08.00
 * - check-expiring-contracts: setiap hari pukul 08.30
 * - check-expired-contracts : setiap hari pukul 07.00
 */
export async function registerScheduledJobs() {
  // Hapus semua repeat job lama terlebih dulu agar tidak duplikat saat restart
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await schedulerQueue.removeRepeatableByKey(job.key);
  }

  await schedulerQueue.add(
    'generate-monthly-bills',
    {},
    { repeat: { pattern: '0 1 1 * *', tz: 'Asia/Jakarta' } },
  );

  await schedulerQueue.add(
    'check-bill-reminders',
    {},
    { repeat: { pattern: '0 8 * * *', tz: 'Asia/Jakarta' } },
  );

  await schedulerQueue.add(
    'check-expiring-contracts',
    {},
    { repeat: { pattern: '30 8 * * *', tz: 'Asia/Jakarta' } },
  );

  await schedulerQueue.add(
    'check-expired-contracts',
    {},
    { repeat: { pattern: '0 7 * * *', tz: 'Asia/Jakarta' } },
  );

  console.log('✓ Recurring scheduled jobs terdaftar');
}
