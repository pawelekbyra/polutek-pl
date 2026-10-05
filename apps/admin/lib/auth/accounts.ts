import { prisma } from "@/lib/prisma";

/**
 * Read models of the panel's own accounts, sessions and sign-in log for Ustawienia → Konto and
 * Bezpieczeństwo. Lives in lib/auth because only this layer may touch the Admin* tables with Prisma.
 * Never returns tokens, secrets, public keys or backup codes.
 */
export type AdminAccountView = {
  id: string;
  email: string;
  name: string;
  role: string;
  enrolledAt: string | null;
  createdAt: string;
  totp: boolean;
  passkeys: { id: string; name: string | null; deviceType: string; backedUp: boolean; createdAt: string | null }[];
  lastSignInAt: string | null;
};

export async function listAdminAccounts(): Promise<AdminAccountView[]> {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true, email: true, name: true, enrolledAt: true, createdAt: true, role: true,
      twoFactors: { where: { verified: true }, select: { id: true } },
      passkeys: { select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const lastIn = await prisma.adminAuthEvent.groupBy({ by: ["adminUserId"], where: { action: "ADMIN_SIGN_IN", outcome: "success", adminUserId: { in: users.map((u) => u.id) } }, _max: { createdAt: true } });
  const lastBy = new Map(lastIn.map((r) => [r.adminUserId, r._max.createdAt]));
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    enrolledAt: u.enrolledAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    totp: u.twoFactors.length > 0,
    passkeys: u.passkeys.map((p) => ({ id: p.id, name: p.name, deviceType: p.deviceType, backedUp: p.backedUp, createdAt: p.createdAt?.toISOString() ?? null })),
    lastSignInAt: lastBy.get(u.id)?.toISOString() ?? null,
  }));
}
