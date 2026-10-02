/** Where an OAuth flow should send the user back to, remembered across the provider round trip. */
export const SSO_RETURN_STORAGE_KEY = "sso-return-to";

/** How long /sso-callback waits for the session before showing a way out instead of a spinner. */
export const SSO_CALLBACK_TIMEOUT_MS = 8000;

/** Only same-site relative paths are allowed; anything else falls back to "/". */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/^\/sso-callback(?:[/?#]|$)/.test(raw)) return "/";
  return raw;
}

export function rememberReturnPath(path: string): void {
  try {
    window.sessionStorage.setItem(SSO_RETURN_STORAGE_KEY, sanitizeReturnPath(path));
  } catch {
    // storage unavailable: the callback falls back to "/"
  }
}

export function readReturnPath(): string {
  try {
    return sanitizeReturnPath(window.sessionStorage.getItem(SSO_RETURN_STORAGE_KEY));
  } catch {
    return "/";
  }
}

/** The path remembered for after sign-in, or null when none was stored (or it is just "/"). */
export function peekReturnPath(): string | null {
  const path = readReturnPath();
  return path === "/" ? null : path;
}

/** Remember `path` only when nothing is stored yet, so the proxy's `next` is not overwritten by the tidied-up URL. */
export function rememberReturnPathIfNone(path: string): void {
  if (peekReturnPath() === null) rememberReturnPath(path);
}

export function clearReturnPath(): void {
  try {
    window.sessionStorage.removeItem(SSO_RETURN_STORAGE_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Adds a query flag to a same-site path, keeping any query/hash it already has. */
export function withQueryFlag(path: string, name: string, value: string): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}${hash}`;
}
