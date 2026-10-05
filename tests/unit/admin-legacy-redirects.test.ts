import { describe, expect, it } from "vitest";
import {
  ADMIN_PANEL_ORIGIN,
  isLegacyAdminApiPath,
  isLegacyAdminPagePath,
  resolveLegacyAdminRedirect,
} from "@/lib/admin-legacy-redirects";

/** Every page the old www admin had (app/admin/**) and the panel screen that took over (docs/architecture/admin-parity.md). */
const MAP: Array<[string, string]> = [
  ["/admin", "/"],
  ["/admin/videos", "/tresci"],
  ["/admin/videos/layout", "/tresci/uklad"],
  ["/admin/videos/clx123", "/tresci"],
  ["/admin/videos/clx123/edit", "/tresci"],
  ["/admin/users", "/spolecznosc?tab=uzytkownicy"],
  ["/admin/users/dashboard", "/spolecznosc?tab=uzytkownicy"],
  ["/admin/users/payments", "/przychody?tab=wplaty"],
  ["/admin/users/u_42", "/spolecznosc/u/u_42"],
  ["/admin/comments", "/spolecznosc?tab=komentarze"],
  ["/admin/comments/reports", "/spolecznosc"],
  ["/admin/emails", "/komunikacja?tab=szablony"],
  ["/admin/emails/broadcast", "/komunikacja?tab=rozsylki"],
  ["/admin/notifications", "/komunikacja?tab=powiadomienia"],
  ["/admin/channel", "/ustawienia?tab=kanal"],
  ["/admin/settings", "/ustawienia?tab=kanal"],
  ["/admin/payments", "/ustawienia?tab=platnosci"],
  ["/admin/diagnostics", "/system"],
];

describe("legacy admin page redirects", () => {
  it.each(MAP)("%s -> panel %s", (from, to) => {
    expect(resolveLegacyAdminRedirect(from)).toBe(`${ADMIN_PANEL_ORIGIN}${to}`);
  });

  it("ignores a trailing slash and the case of the /admin prefix", () => {
    expect(resolveLegacyAdminRedirect("/admin/videos/")).toBe(`${ADMIN_PANEL_ORIGIN}/tresci`);
    expect(resolveLegacyAdminRedirect("/Admin/Users/payments".replace("Users", "users"))).toBe(`${ADMIN_PANEL_ORIGIN}/przychody?tab=wplaty`);
  });

  it("sends an unknown /admin/... path to the panel root", () => {
    expect(resolveLegacyAdminRedirect("/admin/does/not/exist")).toBe(`${ADMIN_PANEL_ORIGIN}/`);
    expect(resolveLegacyAdminRedirect("/admin/users/a/b")).toBe(`${ADMIN_PANEL_ORIGIN}/`);
  });

  it("always targets the panel origin, whatever the path carries (no open redirect)", () => {
    for (const path of ["/admin//evil.example", "/admin/users/%2F%2Fevil.example", "/admin/users/..%2F..", "/admin/\\evil.example"]) {
      const target = resolveLegacyAdminRedirect(path);
      expect(target?.startsWith(`${ADMIN_PANEL_ORIGIN}/`)).toBe(true);
      expect(new URL(target!).origin).toBe(ADMIN_PANEL_ORIGIN);
    }
  });

  it("does not touch public paths or look-alikes", () => {
    for (const path of ["/", "/pl", "/administracja", "/pl/admin", "/api/admin", "/watch/x"]) {
      expect(resolveLegacyAdminRedirect(path)).toBeNull();
    }
    expect(isLegacyAdminPagePath("/admin")).toBe(true);
    expect(isLegacyAdminPagePath("/administrator")).toBe(false);
  });

  it("recognizes the removed API only under /api/admin", () => {
    expect(isLegacyAdminApiPath("/api/admin")).toBe(true);
    expect(isLegacyAdminApiPath("/api/admin/users/export")).toBe(true);
    expect(isLegacyAdminApiPath("/api/administrator")).toBe(false);
    expect(isLegacyAdminApiPath("/api/videos/x")).toBe(false);
  });
});
