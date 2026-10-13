/**
 * `/@handle` addresses (multi-creator platform, stage 7). Pure and edge-safe: the proxy uses it to rewrite
 * `/@name` (and `/pl/@name`, `/en/@name`, `/de/@name`, ...) to the channel page `/<locale>/channel/<name>`,
 * where the page resolves the stable slug, the current handle or a released handle (redirect).
 * The character set is the handle rule of lib/modules/channel/domain/handle.ts (3-30 of a-z 0-9 . _ -);
 * anything else is not a handle path and falls through to the normal routes.
 */
const HANDLE_PATH = /^(?:\/(pl|en|de|es|fr|it|pt|zh))?\/@([A-Za-z0-9._-]{3,30})\/?$/;

export function parseHandlePath(pathname: string): { locale: string; handle: string } | null {
  const m = HANDLE_PATH.exec(pathname);
  if (!m) return null;
  return { locale: m[1] ?? "pl", handle: m[2] };
}

export function handlePathRewrite(pathname: string): string | null {
  const parsed = parseHandlePath(pathname);
  return parsed ? `/${parsed.locale}/channel/${encodeURIComponent(parsed.handle)}` : null;
}
