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
