import { NextResponse } from "next/server";
import type { z } from "zod";

type ParseOptions = {
  /** Treat a missing/unparseable body as `{}` (routes where the body is optional). */
  allowEmpty?: boolean;
  /** Top-level error message (default "Invalid data"). */
  errorMessage?: string;
};

export type ParsedAdminBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Reads a JSON request body through a zod schema. On failure returns a 400 in
 * the repo's usual shape: `{ error, details }`.
 */
export async function parseAdminBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  options: ParseOptions = {},
): Promise<ParsedAdminBody<z.output<S>>> {
  const errorMessage = options.errorMessage ?? "Invalid data";

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    if (!options.allowEmpty) {
      return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
    }
    raw = {};
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: errorMessage, details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
