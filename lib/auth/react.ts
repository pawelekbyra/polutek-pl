"use client";

import { useCallback, useMemo } from "react";
import { authClient } from "./client";

/**
 * Thin hooks over the Better Auth session that keep the shape the components already use
 * (`useAuth` / `useUser`), so the rest of the UI does not depend on the auth library.
 */

export type AuthUser = {
  id: string;
  /** Nickname shown on the site (stored as User.name). */
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Kept for callers that fall back to it; Better Auth accounts have no separate username. */
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
  emailVerified: boolean;
  language: "pl" | "en";
  onboardingPending: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date | string | null;
};

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  emailVerified?: boolean | null;
  language?: string | null;
  onboardingPending?: boolean | null;
  twoFactorEnabled?: boolean | null;
  createdAt?: Date | string | null;
};

export const DEFAULT_AVATAR_PATH = "/default-avatar.jpg";

export function toAuthUser(user: SessionUser): AuthUser {
  return {
    id: user.id,
    fullName: user.name?.trim() || null,
    firstName: user.name?.trim() || null,
    lastName: null,
    username: null,
    imageUrl: user.image || DEFAULT_AVATAR_PATH,
    primaryEmailAddress: user.email ? { emailAddress: user.email } : null,
    emailVerified: user.emailVerified === true,
    language: user.language === "pl" ? "pl" : "en",
    onboardingPending: user.onboardingPending === true,
    twoFactorEnabled: user.twoFactorEnabled === true,
    createdAt: user.createdAt ?? null,
  };
}

export function useAuth() {
  const { data, isPending } = authClient.useSession();
  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);
  return {
    isLoaded: !isPending,
    isSignedIn: Boolean(data?.user),
    userId: (data?.user?.id ?? null) as string | null,
    sessionId: (data?.session?.id ?? null) as string | null,
    signOut,
  };
}

export function useUser() {
  const { data, isPending } = authClient.useSession();
  const sessionUser = data?.user as SessionUser | undefined;
  const user = useMemo(() => (sessionUser ? toAuthUser(sessionUser) : null), [sessionUser]);
  return { isLoaded: !isPending, isSignedIn: Boolean(user), user };
}

/** Re-reads the session from the server (after nickname/avatar/language changes). */
export async function refreshSession() {
  // Bypass the cookie cache once so the new profile is read, then let every useSession() refetch.
  await authClient.getSession({ query: { disableCookieCache: true } });
  authClient.$store.notify("$sessionSignal");
}
