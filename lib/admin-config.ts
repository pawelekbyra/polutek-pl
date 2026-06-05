/**
 * Admin configuration and utility helpers.
 */

export function getAdminClerkUserIds(): string[] {
  return (process.env.ADMIN_CLERK_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isConfiguredAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminClerkUserIds().includes(userId);
}
