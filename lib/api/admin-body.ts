import { NextResponse } from "next/server";
import type { z } from "zod";

type ParseOptions = {
  /** Treat a truly empty body as `{}` (routes where the body is optional). */
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

  // allowEmpty accepts only a truly empty body; malformed JSON is always a 400
  // (a truncated refund body must never fall back to a full refund).
  const invalidJson = () =>
    ({ ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }) as const;
  let raw: unknown;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return invalidJson();
  }
  if (text.trim() === "" && options.allowEmpty) {
    raw = {};
  } else {
    try {
      raw = JSON.parse(text);
    } catch {
      return invalidJson();
    }
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
