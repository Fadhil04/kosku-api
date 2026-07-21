import { env } from '../config/env';

export const welcomeTenantTemplate = (data: {
  fullName: string;
  email: string;
  tempPassword: string;
  propertyName: string;
  roomNumber: string;
}) => ({
  subject: 'Selamat Datang di KosKu — Informasi Akun Kamu',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Selamat Datang, ${data.fullName}!</h2>
      <p>Kamu telah didaftarkan sebagai penghuni di <strong>${data.propertyName}</strong>, Kamar <strong>${data.roomNumber}</strong>.</p>
      <p>Berikut informasi akun kamu untuk masuk ke KosKu:</p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Password Sementara:</strong> ${data.tempPassword}</p>
      </div>
      <p>Segera ganti password kamu setelah login pertama.</p>
      <a href="${env.FRONTEND_URL}/login" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Login Sekarang</a>
      <p style="margin-top: 24px; color: #666; font-size: 14px;">Email ini dikirim otomatis, mohon tidak membalas.</p>
    </div>
  `,
});

export const passwordResetTemplate = (data: {
  fullName: string;
  resetToken: string;
}) => ({
  subject: 'Reset Password KosKu',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Password</h2>
      <p>Halo ${data.fullName},</p>
      <p>Kami menerima permintaan reset password untuk akun kamu. Klik tombol di bawah untuk membuat password baru.</p>
      <p>Link ini hanya berlaku selama <strong>1 jam</strong>.</p>
      <a href="${env.FRONTEND_URL}/reset-password?token=${data.resetToken}" 
         style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0;">
        Reset Password
      </a>
      <p>Jika kamu tidak meminta reset password, abaikan email ini.</p>
      <p style="margin-top: 24px; color: #666; font-size: 14px;">Email ini dikirim otomatis, mohon tidak membalas.</p>
    </div>
  `,
});

export const contractCreatedTenantTemplate = (data: {
  fullName: string;
  propertyName: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
}) => ({
  subject: `Kontrak Kos Kamu di ${data.propertyName} Telah Dibuat`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Kontrak Sewa Dikonfirmasi</h2>
      <p>Halo ${data.fullName},</p>
      <p>Kontrak sewa kamu telah berhasil dibuat. Berikut detailnya:</p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Properti:</strong> ${data.propertyName}</p>
        <p><strong>Kamar:</strong> ${data.roomNumber}</p>
        <p><strong>Mulai:</strong> ${data.startDate}</p>
        <p><strong>Selesai:</strong> ${data.endDate}</p>
        <p><strong>Sewa Bulanan:</strong> Rp ${data.monthlyRent}</p>
      </div>
      <a href="${env.FRONTEND_URL}/dashboard" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Lihat Dashboard</a>
    </div>
  `,
});

export const billReminderTemplate = (data: {
  fullName: string;
  periodLabel: string;
  totalAmount: string;
  dueDate: string;
  daysUntilDue: number;
  billId: string;
}) => ({
  subject: `Pengingat Tagihan ${data.periodLabel} — Jatuh Tempo ${data.daysUntilDue} Hari Lagi`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Pengingat Tagihan Kos</h2>
      <p>Halo ${data.fullName},</p>
      <p>Tagihan kos kamu untuk periode <strong>${data.periodLabel}</strong> akan jatuh tempo dalam <strong>${data.daysUntilDue} hari</strong>.</p>
      <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #F59E0B;">
        <p><strong>Total Tagihan:</strong> Rp ${data.totalAmount}</p>
        <p><strong>Jatuh Tempo:</strong> ${data.dueDate}</p>
      </div>
      <a href="${env.FRONTEND_URL}/bills/${data.billId}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Lihat Tagihan</a>
    </div>
  `,
});

export const paymentConfirmedTemplate = (data: {
  fullName: string;
  periodLabel: string;
  amountPaid: string;
  paymentDate: string;
  referenceNumber?: string;
}) => ({
  subject: `Pembayaran Tagihan ${data.periodLabel} Dikonfirmasi`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Pembayaran Dikonfirmasi ✓</h2>
      <p>Halo ${data.fullName},</p>
      <p>Pembayaran kos kamu untuk periode <strong>${data.periodLabel}</strong> telah dikonfirmasi.</p>
      <div style="background: #D1FAE5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10B981;">
        <p><strong>Jumlah Dibayar:</strong> Rp ${data.amountPaid}</p>
        <p><strong>Tanggal Bayar:</strong> ${data.paymentDate}</p>
        ${data.referenceNumber ? `<p><strong>Nomor Referensi:</strong> ${data.referenceNumber}</p>` : ''}
      </div>
      <p>Terima kasih telah membayar tepat waktu!</p>
    </div>
  `,
});