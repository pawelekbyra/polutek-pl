import { headers } from "next/headers";
import { logger } from "@/lib/logger";

/**
 * The only place server code asks "who is signed in?". Everything else (route handlers, server
 * components, actions) goes through `auth()` / `getAuth()` here, or through lib/api/auth.ts for
 * the DB-backed actor, so Better Auth stays an implementation detail.
 */

export type ServerSessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  language?: string | null;
  onboardingPending?: boolean | null;
};

export type ServerSession = {
  userId: string | null;
  sessionId: string | null;
  user: ServerSessionUser | null;
};

const EMPTY: ServerSession = { userId: null, sessionId: null, user: null };

async function readSession(requestHeaders: Headers, fresh: boolean): Promise<ServerSession> {
  try {
    // Loaded on first use so modules that only import this file (and tests that mock the
    // database) do not pay for initializing Better Auth and its plugins.
    const { auth: betterAuthInstance } = await import("./auth");
    const result = await betterAuthInstance.api.getSession({
      headers: requestHeaders,
      query: fresh ? { disableCookieCache: true } : undefined,
    });
    if (!result?.user?.id) return EMPTY;
    const user = result.user as unknown as ServerSessionUser;
    return { userId: user.id, sessionId: result.session?.id ?? null, user };
  } catch (error) {
    logger.warn("[auth] session lookup failed", error instanceof Error ? error.message : String(error));
    return EMPTY;
  }
}

/** Session of the current request (route handlers, server components, actions). */
export async function auth(options: { fresh?: boolean } = {}): Promise<ServerSession> {
  const requestHeaders = await headers();
  return readSession(requestHeaders, options.fresh === true);
}

/** Session for an explicit request object (e.g. when headers() is not available). */
export async function getAuth(request: Request, options: { fresh?: boolean } = {}): Promise<ServerSession> {
  return readSession(request.headers, options.fresh === true);
}

/** Signed-in user's session profile, or null. */
export async function currentUser(): Promise<ServerSessionUser | null> {
  return (await auth()).user;
}
