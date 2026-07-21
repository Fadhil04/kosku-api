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
});

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    ...options,
  });
};