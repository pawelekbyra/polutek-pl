/**
 * The one way a panel write runs (admin-panel.md section 4): requireAdmin -> zod `.strict()` -> rate limit ->
 * step-up (when sensitive) -> use case -> Polish result. Server Actions of "Społeczność" go through it so the
 * order and the messages are identical everywhere; the use case itself writes the audit row in its transaction.
 * Not used by the content actions that predate it (they follow the same order by hand).
 */
import type { z } from "zod";
import { logger } from "@/lib/logger";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { hasFreshStepUp, requireAdmin, type AdminViewer } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { errorMessage, panelContext, sampleDataRefusal, zodFieldErrors, type ActionResult } from "./panel";
import { checkRateLimit, type LimitRule } from "./rate-limit";

export const STEP_UP_REQUIRED: { ok: false; code: "STEP_UP_REQUIRED"; message: string } = { ok: false, code: "STEP_UP_REQUIRED", message: "Najpierw potwierdź tożsamość (klucz dostępu albo kod TOTP)." };

type Spec<S extends z.ZodTypeAny, T> = {
  /** Where the sign-in screen sends the owner back to when the session is gone. */
  path: string;
  schema: S;
  input: unknown;
  limit: LimitRule;
  stepUp?: boolean;
  run: (args: { data: z.infer<S>; ctx: AppContext; viewer: AdminViewer }) => Promise<ActionResult<T>>;
};

/** Domain error messages (Polish) that must reach the screen as they are, keyed by error code. */
export const DOMAIN_MESSAGES: Record<string, string> = {
  LAST_ADMIN: "To ostatni administrator strony; najpierw nadaj rolę komuś innemu.",
  TARGET_IS_ADMIN: "Tego nie da się zrobić administratorowi strony. Najpierw odbierz mu rolę.",
  CONFIRM_EMAIL_MISMATCH: "Wpisany e-mail nie zgadza się z adresem konta.",
  EMAIL_NOT_VERIFIED: "Administratorem może zostać tylko konto z potwierdzonym e-mailem.",
  USER_ALREADY_DELETED: "To konto jest już usunięte.",
  USER_NOT_FOUND: "To konto nie istnieje.",
  SELF_ACTION_FORBIDDEN: "Tego nie zrobisz na własnym koncie.",
  SESSION_NOT_FOUND: "Ta sesja już nie istnieje.",
};

export function domainError(error: unknown): { ok: false; code?: string; message: string } {
  const e = error as { code?: string; message?: string; type?: string } | null;
  if (e?.code && DOMAIN_MESSAGES[e.code]) return { ok: false, code: e.code, message: DOMAIN_MESSAGES[e.code] };
  // Comment use cases return typed errors whose messages are already Polish and written for the admin.
  if (e?.type && e.message) return { ok: false, code: e.type, message: e.message };
  return { ok: false, ...errorMessage(error) };
}

export async function runAdminAction<S extends z.ZodTypeAny, T = undefined>(spec: Spec<S, T>): Promise<ActionResult<T>> {
  const viewer = await requireAdmin(spec.path);
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = spec.schema.safeParse(spec.input);
  if (!parsed.success) return { ok: false, code: "BAD_REQUEST", message: "Niepoprawne żądanie.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const limited = checkRateLimit(viewer.userId, spec.limit);
  if (!limited.ok) return { ok: false, code: "RATE_LIMITED", message: `Za dużo prób w krótkim czasie. Spróbuj za ${limited.retryAfterSeconds} s.` };
  if (spec.stepUp && !(await hasFreshStepUp())) return STEP_UP_REQUIRED;
  try {
    return await spec.run({ data: parsed.data, ctx: await panelContext(viewer), viewer });
  } catch (error) {
    // redirect() and notFound() are implemented as thrown signals: let Next handle them.
    if ((error as { digest?: string } | null)?.digest?.startsWith("NEXT_")) throw error;
    logger.error(`[panel-action:${spec.limit.bucket}]`, error);
    return { ok: false, message: "Nie udało się wykonać operacji. Spróbuj ponownie." };
  }
}
