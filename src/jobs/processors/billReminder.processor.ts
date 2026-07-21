import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { billReminderTemplate } from '../../utils/emailTemplates';
import { calculateLateFee } from '../../utils/lateFee.calculator';
import type { BillReminderJobData } from '../queues/email.queue';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export async function processBillReminder(data: BillReminderJobData) {
  const bill = await prisma.bill.findUnique({
    where: { id: data.billId },
    include: {
      tenant: { select: { fullName: true, email: true } },
      room: { select: { roomNumber: true } },
      property: { select: { name: true, ownerId: true } },
    },
  });

  if (!bill) {
    console.warn(`Bill ${data.billId} tidak ditemukan, skip reminder`);
    return { skipped: true, reason: 'bill_not_found' };
  }

  // Kalau bill sudah lunas atau waived, tidak perlu reminder lagi
  if (bill.status === 'PAID' || bill.status === 'WAIVED') {
    return { skipped: true, reason: 'bill_already_settled' };
  }

  const periodLabel = `${MONTH_NAMES[bill.periodMonth - 1]} ${bill.periodYear}`;
  const lateFeeInfo = calculateLateFee({
    totalAmount: Number(bill.totalAmount) - Number(bill.discountAmount),
    dueDate: bill.dueDate,
    lateFeePercentage: Number(bill.lateFeePercentage),
    lateFeeMaxPercentage: Number(bill.lateFeeMaxPercentage),
    status: bill.status,
  });

  // Reminder H-7 dan H-3: belum jatuh tempo
  if (data.reminderType === 'H-7' || data.reminderType === 'H+1') {
    const daysUntilDue = Math.ceil(
      (bill.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const template = billReminderTemplate({
      fullName: bill.tenant.fullName,
      periodLabel,
      totalAmount: lateFeeInfo.finalAmount.toLocaleString('id-ID'),
      dueDate: bill.dueDate.toLocaleDateString('id-ID'),
      daysUntilDue: Math.abs(daysUntilDue),
      billId: bill.id,
    });

    await sendEmail({
      to: bill.tenant.email,
      subject: template.subject,
      html: template.html,
    });

    return { sent: true, type: data.reminderType, billId: bill.id };
  }

  // H+7: eskalasi ke owner, bukan tenant
  if (data.reminderType === 'H+7') {
    const owner = await prisma.owner.findUnique({
      where: { id: bill.property.ownerId },
      select: { email: true, fullName: true },
    });

    if (owner) {
      await sendEmail({
        to: owner.email,
        subject: `Penghuni Belum Bayar 7 Hari — Kamar ${bill.room.roomNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Eskalasi Tagihan Terlambat</h2>
            <p>Halo ${owner.fullName},</p>
            <p>Penghuni <strong>${bill.tenant.fullName}</strong> di kamar 
               <strong>${bill.room.roomNumber}</strong> (${bill.property.name}) 
               belum membayar tagihan periode <strong>${periodLabel}</strong> 
               selama <strong>${lateFeeInfo.daysOverdue} hari</strong>.</p>
            <div style="background: #FEE2E2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #EF4444;">
              <p><strong>Total Tagihan + Denda:</strong> Rp ${lateFeeInfo.finalAmount.toLocaleString('id-ID')}</p>
            </div>
          </div>
        `,
      });
    }

    return { sent: true, type: 'H+7', billId: bill.id };
  }

  return { skipped: true, reason: 'unknown_reminder_type' };
}