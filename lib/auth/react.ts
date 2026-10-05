"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { authClient } from "./client";
import { signOutCompletely } from "./sign-out";
import type { AuthSessionSnapshot } from "./session-snapshot";

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
  language: Locale;
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
    language: isLocale(user.language) ? user.language : "en",
    onboardingPending: user.onboardingPending === true,
    twoFactorEnabled: user.twoFactorEnabled === true,
    createdAt: user.createdAt ?? null,
  };
}

/**
 * The viewer's session as the server rendered the page: `undefined` = no server snapshot (static
 * pages, or once the client has its own answer), `null` = the server saw a guest.
 */
const SessionSeedContext = createContext<AuthSessionSnapshot | null | undefined>(undefined);

type SessionState = { data: { user?: SessionUser | null; session?: { id?: string | null } | null } | null; isPending: boolean };

/**
 * Better Auth's client starts "pending" and asks `/api/auth/get-session` after hydration. Under
 * this provider the hooks answer from the server's snapshot instead, so the server HTML and the
 * first client render already show the real state. Better Auth still refreshes the session in the
 * background; once it has answered (or after any later change), its own state wins and the
 * snapshot is never used again, so a sign-in or sign-out on the page is never masked by it.
 */
export function AuthSessionSeedProvider({
  snapshot,
  children,
}: {
  snapshot: AuthSessionSnapshot | null;
  children: ReactNode;
}) {
  const { isPending } = authClient.useSession();
  // Once Better Auth has answered, the snapshot is retired for good (adjusted during render, so
  // no render ever pairs a stale snapshot with a settled client state).
  const [seedActive, setSeedActive] = useState(true);
  if (seedActive && !isPending) setSeedActive(false);

  // Hand the signed-in session to Better Auth's store before its first fetch, so a failed
  // background refresh (network) keeps the user signed in instead of dropping to "guest".
  useLayoutEffect(() => {
    if (snapshot) authClient.hydrateSession(snapshot as unknown as Parameters<typeof authClient.hydrateSession>[0]);
  }, [snapshot]);

  return createElement(SessionSeedContext.Provider, { value: seedActive ? snapshot : undefined }, children);
}

function useSessionState(): SessionState {
  const { data, isPending } = authClient.useSession();
  const seed = useContext(SessionSeedContext);
  if (isPending && seed !== undefined) return { data: seed, isPending: false };
  return { data: (data ?? null) as SessionState["data"], isPending };
}

export function useAuth() {
  const { data, isPending } = useSessionState();
  const signOut = useCallback(async () => {
    await signOutCompletely();
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
  const { data, isPending } = useSessionState();
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
