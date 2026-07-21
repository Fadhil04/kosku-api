import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import type { ContractExpiryJobData } from '../queues/email.queue';

export async function processContractExpiry(data: ContractExpiryJobData) {
  const contract = await prisma.contract.findUnique({
    where: { id: data.contractId },
    include: {
      tenant: { select: { fullName: true, email: true } },
      room: {
        include: {
          property: {
            select: { name: true, owner: { select: { email: true, fullName: true } } },
          },
        },
      },
    },
  });

  if (!contract || contract.status !== 'ACTIVE') {
    return { skipped: true, reason: 'contract_not_active' };
  }

  const daysRemaining = Math.ceil(
    (contract.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>Kontrak Akan Segera Berakhir</h2>
      <p>Kontrak sewa kamar <strong>${contract.room.roomNumber}</strong> 
         di <strong>${contract.room.property.name}</strong> akan berakhir dalam 
         <strong>${daysRemaining} hari</strong> (${contract.endDate.toLocaleDateString('id-ID')}).</p>
    </div>
  `;

  // Kirim ke tenant
  await sendEmail({
    to: contract.tenant.email,
    subject: `Kontrak Kos Kamu Akan Berakhir dalam ${daysRemaining} Hari`,
    html: emailContent.replace(
      '<h2>Kontrak Akan Segera Berakhir</h2>',
      `<h2>Kontrak Akan Segera Berakhir</h2><p>Halo ${contract.tenant.fullName},</p>`,
    ),
  });

  // Kirim ke owner
  await sendEmail({
    to: contract.room.property.owner.email,
    subject: `Kontrak Penghuni Kamar ${contract.room.roomNumber} Akan Berakhir`,
    html: emailContent.replace(
      '<h2>Kontrak Akan Segera Berakhir</h2>',
      `<h2>Kontrak Akan Segera Berakhir</h2><p>Halo ${contract.room.property.owner.fullName},</p>`,
    ),
  });

  return { sent: true, contractId: contract.id, daysRemaining };
}