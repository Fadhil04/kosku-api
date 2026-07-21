import { env } from './config/env';
import { emailWorker } from './jobs/workers/email.worker';
import { schedulerWorker } from './jobs/workers/scheduler.worker';
import { registerScheduledJobs } from './jobs/queues/scheduler.queue';

async function startWorkers() {
  console.log(`Starting workers in ${env.NODE_ENV} mode...`);

  await registerScheduledJobs();

  console.log('Email worker started');
  console.log('Scheduler worker started');
  console.log('Workers siap menerima job');
}

startWorkers().catch((err) => {
  console.error('Gagal start workers:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM diterima, menutup workers...');
  await emailWorker.close();
  await schedulerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT diterima, menutup workers...');
  await emailWorker.close();
  await schedulerWorker.close();
  process.exit(0);
});