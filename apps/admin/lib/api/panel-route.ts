/**
 * Route handlers of the panel (uploads, thumbnail preview): who is calling, the use-case context, and one
 * JSON shape for answers. Errors are `{ error, code }` with the use case's status code and a Polish
 * message; database or storage details never reach the browser. Never cached.
 */
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { UseCaseResult } from "@/lib/modules/shared/result";
import { errorMessage } from "@admin/lib/actions/panel";
import { adminFromRequest } from "@admin/lib/auth/api-guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import {
  DEFAULT_JSON_BODY_MAX_BYTES,
  MalformedFormDataBodyError,
  readRequestFormDataWithLimit,
  readRequestJsonWithLimit,
  RequestBodyTooLargeError,
  TooManyFormEntriesError,
} from "@/lib/utils/request-body";

const NO_STORE = { "cache-control": "private, no-store" };

/** `next dev` with sample data has no database: answer every write with a clear 409 instead of a crash. */
export function sampleDataResponse(): Response | null {
  return isDevFixturesEnabled() ? jsonError(409, "Dane przykładowe: zapis jest wyłączony (ADMIN_DEV_FIXTURES=1).", "SAMPLE_DATA") : null;
}

export async function panelRouteContext(request: Request): Promise<AppContext | null> {
  const admin = await adminFromRequest(request);
  if (!admin) return null;
  const requestId = request.headers.get("cf-ray") ?? request.headers.get("x-request-id") ?? undefined;
  return createAppContext({ actor: { type: "admin", userId: admin.userId }, requestId });
}

export function jsonError(status: number, message: string, code?: string): Response {
  return Response.json({ error: message, code }, { status, headers: NO_STORE });
}

export const unauthorizedJson = () => jsonError(401, "Sesja panelu wygasła. Zaloguj się ponownie.", "UNAUTHORIZED");

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function resultResponse<T>(result: UseCaseResult<T, unknown>): Response {
  if (result.ok) return jsonOk(result.data);
  const e = result.error as { statusCode?: number } | null;
  const status = typeof e?.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500;
  const { message, code } = errorMessage(result.error, status >= 500 ? "Błąd serwera. Spróbuj ponownie." : "Nie udało się wykonać operacji.");
  return jsonError(status, message, code);
}

/** Reads and validates a JSON body; a malformed body is 400, never treated as empty. */
export async function readJson<T>(
  request: Request,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  maxBytes = DEFAULT_JSON_BODY_MAX_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await readRequestJsonWithLimit(request, maxBytes);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { ok: false, response: jsonError(413, "Żądanie jest za duże.", "PAYLOAD_TOO_LARGE") };
    raw = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: jsonError(400, "Niepoprawne żądanie.", "BAD_REQUEST") };
  return { ok: true, data: parsed.data };
}

/** Reads the raw bytes of a single uploaded file from multipart/form-data, capped at `maxBytes`. */
export async function readUploadedFile(request: Request, field: string, maxBytes: number): Promise<{ ok: true; bytes: Uint8Array; name: string } | { ok: false; response: Response }> {
  const totalBytes = maxBytes + 64 * 1024;
  let form: FormData;
  try {
    form = await readRequestFormDataWithLimit(request, totalBytes, 8);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return { ok: false, response: jsonError(413, `Plik lub formularz jest za duży (limit ${Math.round(maxBytes / 1024 / 1024)} MB plus narzut).`, "FILE_TOO_LARGE") };
    if (error instanceof TooManyFormEntriesError) return { ok: false, response: jsonError(413, "Formularz zawiera za dużo części.", "TOO_MANY_PARTS") };
    if (error instanceof MalformedFormDataBodyError) return { ok: false, response: jsonError(400, "Niepoprawny formularz.", "BAD_REQUEST") };
    return { ok: false, response: jsonError(400, "Niepoprawny formularz.", "BAD_REQUEST") };
  }
  const files = form.getAll(field);
  const file = files.length === 1 ? files[0] : null;
  if (!file || typeof file === "string") return { ok: false, response: jsonError(400, "Nie wybrano pliku.", "FILE_MISSING") };
  if (file.size > maxBytes) return { ok: false, response: jsonError(413, `Plik jest za duży (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`, "FILE_TOO_LARGE") };
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
}
