import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { billReminderTemplate } from '../../utils/emailTemplates';
import { checkOverdue } from '../../utils/overdueChecker';
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

  if (!bill) return { skipped: true, reason: 'bill_not_found' };
  if (bill.status === 'PAID' || bill.status === 'WAIVED') {
    return { skipped: true, reason: 'bill_already_settled' };
  }

  const periodLabel = `${MONTH_NAMES[bill.periodMonth - 1]} ${bill.periodYear}`;
  const amountAfterDiscount = Number(bill.totalAmount) - Number(bill.discountAmount);
  const overdueInfo = checkOverdue({ totalAmount: amountAfterDiscount, dueDate: bill.dueDate, status: bill.status });

  const daysUntilDue = Math.ceil((bill.dueDate.getTime() - Date.now()) / 86400000);

  // H-7 dan H-3: reminder sebelum jatuh tempo → kirim ke tenant
  if (data.reminderType === 'H-7' || data.reminderType === 'H-3') {
    const template = billReminderTemplate({
      fullName: bill.tenant.fullName,
      periodLabel,
      totalAmount: amountAfterDiscount.toLocaleString('id-ID'),
      dueDate: bill.dueDate.toLocaleDateString('id-ID'),
      daysUntilDue: Math.abs(daysUntilDue),
      billId: bill.id,
    });

    await sendEmail({ to: bill.tenant.email, subject: template.subject, html: template.html });
    return { sent: true, type: data.reminderType, billId: bill.id };
  }

  // H+1: notifikasi sudah melewati jatuh tempo → kirim ke tenant
  if (data.reminderType === 'H+1') {
    await sendEmail({
      to: bill.tenant.email,
      subject: `Tagihan ${periodLabel} Sudah Melewati Jatuh Tempo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Tagihan Melewati Jatuh Tempo</h2>
          <p>Halo ${bill.tenant.fullName},</p>
          <p>Tagihan kamu untuk periode <strong>${periodLabel}</strong> 
             (Rp ${amountAfterDiscount.toLocaleString('id-ID')}) 
             sudah melewati jatuh tempo <strong>1 hari</strong>.</p>
          <p>Segera hubungi pemilik kos untuk informasi lebih lanjut.</p>
        </div>
      `,
    });
    return { sent: true, type: 'H+1', billId: bill.id };
  }

  // H+7: eskalasi ke owner — tenant belum bayar 7 hari
  if (data.reminderType === 'H+7') {
    const owner = await prisma.owner.findUnique({
      where: { id: bill.property.ownerId },
      select: { email: true, fullName: true },
    });

    if (owner) {
      await sendEmail({
        to: owner.email,
        subject: `⚠️ Perlu Perhatian — ${bill.tenant.fullName} Belum Bayar 7 Hari`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Tagihan Belum Dibayar — Perlu Tindak Lanjut</h2>
            <p>Halo ${owner.fullName},</p>
            <p>Penghuni <strong>${bill.tenant.fullName}</strong> di kamar 
               <strong>${bill.room.roomNumber}</strong> (${bill.property.name}) 
               belum membayar tagihan periode <strong>${periodLabel}</strong> 
               selama <strong>${overdueInfo.daysOverdue} hari</strong>.</p>
            <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #D97706;">
              <p><strong>Jumlah tagihan:</strong> Rp ${amountAfterDiscount.toLocaleString('id-ID')}</p>
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                Kamu bisa memutuskan untuk mengingatkan kembali atau mengambil tindakan sesuai kebijakan kos.
              </p>
            </div>
          </div>
        `,
      });
    }

    return { sent: true, type: 'H+7', billId: bill.id };
  }

  return { skipped: true, reason: 'unknown_reminder_type' };
}
