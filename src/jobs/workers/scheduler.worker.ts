import { Worker, Job } from 'bullmq';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { emailQueue } from '../queues/email.queue';
import { processMonthlyBillGeneration } from '../processors/monthlyBillGenerator.processor';

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};

export const schedulerWorker = new Worker(
  'scheduled-tasks',
  async (job: Job) => {
    console.log(`Running scheduled task: ${job.name}`);

    switch (job.name) {
      case 'generate-monthly-bills':
        return await processMonthlyBillGeneration();

      case 'check-bill-reminders':
        return await checkAndQueueBillReminders();

      case 'check-expiring-contracts':
        return await checkAndQueueExpiringContracts();

      default:
        console.warn(`Scheduled task tidak dikenal: ${job.name}`);
        return { skipped: true };
    }
  },
  { connection, concurrency: 1 }, // scheduler jalan satu per satu, tidak perlu paralel
);

// ────────────────────────────────────────────────
// Cek semua bill yang perlu reminder hari ini,
// lalu push masing-masing sebagai job terpisah ke email queue
// ────────────────────────────────────────────────
async function checkAndQueueBillReminders() {
  const now = new Date();
  let totalQueued = 0;

  // H-7: due date 7 hari dari sekarang
  const h7Date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const h7Bills = await prisma.bill.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: {
        gte: new Date(h7Date.getFullYear(), h7Date.getMonth(), h7Date.getDate()),
        lt: new Date(h7Date.getFullYear(), h7Date.getMonth(), h7Date.getDate() + 1),
      },
    },
    select: { id: true },
  });

  for (const bill of h7Bills) {
    await emailQueue.add('send-bill-reminder', {
      billId: bill.id,
      reminderType: 'H-7',
    });
    totalQueued += 1;
  }

  // H-3: due date 3 hari dari sekarang
  const h3Date = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const h3Bills = await prisma.bill.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: {
        gte: new Date(h3Date.getFullYear(), h3Date.getMonth(), h3Date.getDate()),
        lt: new Date(h3Date.getFullYear(), h3Date.getMonth(), h3Date.getDate() + 1),
      },
    },
    select: { id: true },
  });

  for (const bill of h3Bills) {
    await emailQueue.add('send-bill-reminder', {
      billId: bill.id,
      reminderType: 'H-3',
    });
    totalQueued += 1;
  }

  // H+1: baru lewat 1 hari dari due date
  const h1AgoDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const h1Bills = await prisma.bill.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: {
        gte: new Date(h1AgoDate.getFullYear(), h1AgoDate.getMonth(), h1AgoDate.getDate()),
        lt: new Date(h1AgoDate.getFullYear(), h1AgoDate.getMonth(), h1AgoDate.getDate() + 1),
      },
    },
    select: { id: true },
  });

  for (const bill of h1Bills) {
    await emailQueue.add('send-bill-reminder', {
      billId: bill.id,
      reminderType: 'H+1',
    });
    totalQueued += 1;
  }

  // H+7: sudah terlambat 7 hari, eskalasi ke owner
  const h7AgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const h7OverdueBills = await prisma.bill.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      dueDate: {
        gte: new Date(h7AgoDate.getFullYear(), h7AgoDate.getMonth(), h7AgoDate.getDate()),
        lt: new Date(h7AgoDate.getFullYear(), h7AgoDate.getMonth(), h7AgoDate.getDate() + 1),
      },
    },
    select: { id: true },
  });

  for (const bill of h7OverdueBills) {
    await emailQueue.add('send-bill-reminder', {
      billId: bill.id,
      reminderType: 'H+7',
    });
    totalQueued += 1;
  }

  console.log(`Bill reminder check selesai: ${totalQueued} job di-queue`);
  return { totalQueued };
}

// ────────────────────────────────────────────────
// Cek kontrak yang akan expire dalam 30 hari
// ────────────────────────────────────────────────
async function checkAndQueueExpiringContracts() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringContracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: new Date(in30Days.getFullYear(), in30Days.getMonth(), in30Days.getDate()),
        lt: new Date(in30Days.getFullYear(), in30Days.getMonth(), in30Days.getDate() + 1),
      },
    },
    select: { id: true },
  });

  let totalQueued = 0;
  for (const contract of expiringContracts) {
    await emailQueue.add('send-contract-expiry-notice', {
      contractId: contract.id,
    });
    totalQueued += 1;
  }

  console.log(`Contract expiry check selesai: ${totalQueued} job di-queue`);
  return { totalQueued };
}

schedulerWorker.on('completed', (job, result) => {
  console.log(`✓ Scheduled task ${job.name} selesai:`, result);
});

schedulerWorker.on('failed', (job, err) => {
  console.error(`✗ Scheduled task ${job?.name} gagal:`, err.message);
});