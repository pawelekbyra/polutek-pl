import { AppError } from "@/lib/modules/shared/app-error";
import type { UseCaseResult } from "@/lib/modules/shared/result";
import type { ChannelSummaryDto } from "@/lib/modules/channel";
import { resolveStudioSession, type StudioSession } from "./studio-session";

/**
 * Route plumbing of the Studio API (`/api/studio/*`): one JSON error shape `{ error, code }`, never cached,
 * database details never reach the browser. CSRF and the session-cookie gate are applied in middleware.ts.
 */

const NO_STORE = { "cache-control": "private, no-store" };

export function studioJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function studioError(status: number, message: string, code?: string): Response {
  return Response.json({ error: message, code }, { status, headers: NO_STORE });
}

const TYPE_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  DATABASE_ERROR: 500,
};

/** Maps any use-case error (AppError or the comments module's tagged union) to status, message and code. */
export function describeError(error: unknown): { status: number; message: string; code?: string } {
  if (error instanceof AppError) return { status: error.statusCode, message: error.message, code: error.code };
  const e = error as { statusCode?: number; type?: string; message?: string; code?: string } | null;
  if (e && typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600) {
    return { status: e.statusCode, message: e.message ?? "Nie udało się wykonać operacji.", code: e.code };
  }
  if (e?.type && TYPE_STATUS[e.type]) {
    const status = TYPE_STATUS[e.type];
    // A 500 never carries internal text.
    return { status, message: status >= 500 ? "Błąd serwera. Spróbuj ponownie." : (e.message ?? "Nie udało się wykonać operacji."), code: e.code ?? e.type };
  }
  return { status: 500, message: "Błąd serwera. Spróbuj ponownie." };
}

export function studioResult<T>(result: UseCaseResult<T, unknown>, successStatus = 200): Response {
  // Several use cases succeed with no payload; the browser still gets a JSON body.
  if (result.ok) return studioJson(result.data === undefined ? { ok: true } : result.data, successStatus);
  const { status, message, code } = describeError(result.error);
  return studioError(status, message, code);
}

/** Reads and validates a JSON body; a malformed body is 400, never treated as empty. */
export async function readStudioJson<T>(
  request: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const raw = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: studioError(400, "Niepoprawne żądanie.", "BAD_REQUEST") };
  return { ok: true, data: parsed.data };
}

export type StudioHandlerContext = StudioSession & { requireChannel: () => ChannelSummaryDto };

/**
 * Wraps a handler: 401 without a session, 409 `NO_CHANNEL` when the handler needs a channel and the user has none,
 * and any thrown AppError becomes its JSON error. `?channel=<id>` selects one of the user's own channels.
 */
export async function withStudio(
  request: Request,
  options: { channel: boolean },
  handler: (session: StudioSession & { channel: ChannelSummaryDto | null }) => Promise<Response>,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? undefined;
    const session = await resolveStudioSession({ requestId, channelId: url.searchParams.get("channel") });
    if (!session) return studioError(401, "Zaloguj się, aby korzystać ze Studia.", "UNAUTHORIZED");
    if (options.channel && !session.channel) {
      return studioError(409, "Najpierw załóż kanał.", "NO_CHANNEL");
    }
    return await handler(session);
  } catch (error) {
    const { status, message, code } = describeError(error);
    return studioError(status, message, code);
  }
}
