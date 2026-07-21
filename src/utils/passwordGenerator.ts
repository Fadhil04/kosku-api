export const generateTemporaryPassword = (): string => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%';

  const getRandomChar = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)];

  let password = '';
  password += getRandomChar(uppercase);
  password += getRandomChar(uppercase);
  password += getRandomChar(lowercase);
  password += getRandomChar(lowercase);
  password += getRandomChar(lowercase);
  password += getRandomChar(numbers);
  password += getRandomChar(numbers);
  password += getRandomChar(symbols);

  // Shuffle
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};