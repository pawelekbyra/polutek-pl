export function normalizeTrustedEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return basicEmailPattern.test(normalized) ? normalized : null;
}

export function maskEmailForLog(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');
  const maskedLocal = localPart.length <= 2
    ? `${localPart.slice(0, 1)}***`
    : `${localPart.slice(0, 2)}***`;
  const [domainName = '', ...domainRest] = domain.split('.');
  const maskedDomain = domainName ? `${domainName.slice(0, 1)}***` : '***';
  return `${maskedLocal}@${[maskedDomain, ...domainRest].filter(Boolean).join('.')}`;
}
