import { Worker, Job } from 'bullmq';
import { prisma } from '../../config/database';
import { emailQueue } from '../queues/email.queue';
import { processMonthlyBillGeneration } from '../processors/monthlyBillGenerator.processor';
import { getRedisConnection } from '../../config/redis';

const connection = getRedisConnection();

export const schedulerWorker = new Worker(
  'scheduled-tasks',
  async (job: Job) => {
    console.log(`[Scheduler] Running: ${job.name}`);

    switch (job.name) {
      case 'generate-monthly-bills':
        return await processMonthlyBillGeneration();

      case 'check-bill-reminders':
        return await checkAndQueueBillReminders();

      case 'check-expiring-contracts':
        return await checkAndQueueExpiringContracts();

      case 'check-expired-contracts':
        return await markExpiredContracts();

      default:
        console.warn(`[Scheduler] Job tidak dikenal: ${job.name}`);
        return { skipped: true };
    }
  },
  { connection, concurrency: 1 },
);

// ── Reminder tagihan ─────────────────────────────────────────────
async function checkAndQueueBillReminders() {
  const now = new Date();
  let totalQueued = 0;

  const reminderDays = [
    { key: 'H-7', offset: +7 },
    { key: 'H-3', offset: +3 },
    { key: 'H+1', offset: -1 },
    { key: 'H+7', offset: -7 },
  ];

  for (const { key, offset } of reminderDays) {
    const target = new Date(now.getTime() + offset * 86400000);
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const dayEnd   = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1);

    const bills = await prisma.bill.findMany({
      where: {
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });

    for (const bill of bills) {
      await emailQueue.add('send-bill-reminder', { billId: bill.id, reminderType: key });
      totalQueued++;
    }
  }

  console.log(`[Scheduler] Bill reminders queued: ${totalQueued}`);
  return { totalQueued };
}

// ── Notifikasi kontrak mau berakhir ──────────────────────────────
async function checkAndQueueExpiringContracts() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const contracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: new Date(in30.getFullYear(), in30.getMonth(), in30.getDate()),
        lt:  new Date(in30.getFullYear(), in30.getMonth(), in30.getDate() + 1),
      },
    },
    select: { id: true },
  });

  for (const c of contracts) {
    await emailQueue.add('send-contract-expiry-notice', { contractId: c.id });
  }

  console.log(`[Scheduler] Expiring contract notices queued: ${contracts.length}`);
  return { totalQueued: contracts.length };
}

// ── Tandai kontrak yang sudah expired ────────────────────────────
async function markExpiredContracts() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Ambil semua kontrak ACTIVE yang endDate-nya sudah lewat
  const expiredContracts = await prisma.contract.findMany({
    where: { status: 'ACTIVE', endDate: { lt: today } },
    select: { id: true, roomId: true },
  });

  if (expiredContracts.length === 0) {
    return { updated: 0 };
  }

  const ids = expiredContracts.map((c) => c.id);
  const roomIds = [...new Set(expiredContracts.map((c) => c.roomId))];

  await prisma.$transaction(async (tx) => {
    // Update kontrak ke EXPIRED
    await tx.contract.updateMany({
      where: { id: { in: ids } },
      data: { status: 'EXPIRED' },
    });

    // Kamar yang kontraknya expired → NEEDS_MAINTENANCE
    await tx.room.updateMany({
      where: { id: { in: roomIds } },
      data: { status: 'NEEDS_MAINTENANCE' },
    });

    // Audit log
    for (const contractId of ids) {
      await tx.auditLog.create({
        data: {
          entityType: 'contract',
          entityId: contractId,
          action: 'AUTO_EXPIRED',
          newValues: { status: 'EXPIRED', reason: 'end_date_passed' },
          performedBy: 'system',
          performerRole: 'system',
        },
      });
    }
  });

  console.log(`[Scheduler] Contracts marked EXPIRED: ${expiredContracts.length}`);
  return { updated: expiredContracts.length };
}

schedulerWorker.on('completed', (job, result) => {
  console.log(`[Scheduler] ✓ ${job.name} done:`, result);
});

schedulerWorker.on('failed', (job, err) => {
  console.error(`[Scheduler] ✗ ${job?.name} failed:`, err.message);
});
