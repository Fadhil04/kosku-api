import crypto from 'crypto';

export const generateRandomToken = (length = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const getPasswordResetExpiry = (): Date => {
  const date = new Date();
  date.setHours(date.getHours() + 1); // 1 jam
  return date;
};