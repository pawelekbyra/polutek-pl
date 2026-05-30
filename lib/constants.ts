export const DEFAULT_AVATAR_URL = 'https://www.dicebear.com/api/avataaars/anonymous.svg';

export const MIN_PATRON_AMOUNT = 5; // EUR
export const MIN_PATRON_AMOUNT_PLN = 20; // PLN

const adminEmail = process.env.ADMIN_EMAIL;
if (!adminEmail && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_EMAIL env variable is required in production');
}
export const ADMIN_EMAIL = adminEmail || "pawel.perfect@gmail.com";
