/**
 * Break-glass diagnostics token (HEALTHCHECK_TOKEN).
 *
 * Accepted ONLY in the `x-health-token` header - never in the query string,
 * which ends up in access logs and browser history. Compared in constant time.
 *
 * Edge-safe on purpose (middleware imports this): it does not use
 * node:crypto's timingSafeEqual, which is unavailable on the Edge runtime.
 * The loop below has the same property: it always walks the longer of the two
 * inputs and folds the length difference into the result, so timing does not
 * reveal a matching prefix or the secret's length.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

type Env = Record<string, string | undefined>;

export function isHealthTokenValue(provided: string | null | undefined, env: Env = process.env): boolean {
  const expected = env.HEALTHCHECK_TOKEN;
  if (!expected || !provided) return false;
  return constantTimeEqual(provided, expected);
}

export function isHealthTokenAuthorized(req: { headers: Headers }, env: Env = process.env): boolean {
  return isHealthTokenValue(req.headers.get("x-health-token"), env);
}
