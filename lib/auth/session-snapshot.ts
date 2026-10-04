import type { ServerSession } from "./server";

/**
 * The signed-in viewer's own session, handed from the server render to the browser so the first
 * HTML already shows the right navbar (avatar or "sign in"), lock states and likes, with no
 * "loading" state while the client asks `/api/auth/get-session`.
 *
 * Only what the UI shows about the viewer themself: no session token, no IP/user agent. It travels
 * only inside a per-viewer, `no-store` page (never a shared cache), like the rest of that page.
 */
export type AuthSessionSnapshot = {
  session: { id: string; userId: string; expiresAt: string | null };
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    emailVerified: boolean;
    language: string | null;
    onboardingPending: boolean;
    twoFactorEnabled: boolean;
    createdAt: string | null;
  };
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Snapshot of a server session; `null` for a guest (the server knows nobody is signed in). */
export function toAuthSessionSnapshot(session: ServerSession): AuthSessionSnapshot | null {
  const user = session.user;
  if (!session.userId || !session.sessionId || !user) return null;
  return {
    session: { id: session.sessionId, userId: session.userId, expiresAt: toIso(session.sessionExpiresAt) },
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified === true,
      language: user.language ?? null,
      onboardingPending: user.onboardingPending === true,
      twoFactorEnabled: user.twoFactorEnabled === true,
      createdAt: toIso(user.createdAt),
    },
  };
}
