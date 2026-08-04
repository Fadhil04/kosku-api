import nodemailer from 'nodemailer';
import { env } from './env';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  family: 4, // Memaksa koneksi menggunakan IPv4
  tls: {
    rejectUnauthorized: false,
  },
} as any);

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    // Jika RESEND_API_KEY diset di Railway, kirim email via HTTP API (tidak akan diblokir)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: env.SMTP_FROM || 'KosKu <onboarding@resend.dev>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend HTTP API Error: ${response.status} - ${errorText}`);
    }
    console.log('[EmailService] Email berhasil dikirim via Resend HTTP API');
    return;
  }

  // Fallback ke Nodemailer (SMTP) jika dijalankan di lokal
  await transporter.sendMail({
    from: env.SMTP_FROM,
    ...options,
  });
};