import type { IconName } from "@admin/components/icons";

/**
 * The 8 modules of the panel plus "Premiera na żywo" and "Ustawienia" (admin-panel.md section 3).
 * `key` is the second key of the `g` + letter shortcut. `phase` says when a module gets real screens;
 * until then its page honestly describes the scope instead of showing a mock.
 */
export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  key: string;
  phase: 1 | 2 | 3 | 4;
  /** Name of the badge counter in NavCounts, spoken as "<n> <what>". */
  count?: "moderation" | "contentErrors" | "systemAlerts";
  what?: string;
};

export const NAV: NavItem[] = [
  { id: "dzisiaj", href: "/", label: "Dzisiaj", icon: "today", key: "d", phase: 1 },
  { id: "analityka", href: "/analityka", label: "Analityka", icon: "chart", key: "a", phase: 2 },
  { id: "tresci", href: "/tresci", label: "Treści", icon: "film", key: "t", phase: 2, count: "contentErrors", what: "filmy z błędem kodowania" },
  { id: "spolecznosc", href: "/spolecznosc", label: "Społeczność", icon: "users", key: "s", phase: 3, count: "moderation", what: "do moderacji" },
  { id: "przychody", href: "/przychody", label: "Przychody", icon: "coins", key: "p", phase: 3 },
  { id: "komunikacja", href: "/komunikacja", label: "Komunikacja", icon: "mail", key: "k", phase: 3 },
  { id: "system", href: "/system", label: "System", icon: "server", key: "y", phase: 1, count: "systemAlerts", what: "ostrzeżenia systemu" },
  { id: "bezpieczenstwo", href: "/bezpieczenstwo", label: "Bezpieczeństwo", icon: "shield", key: "b", phase: 3 },
];

export const NAV_FOOT: NavItem[] = [
  { id: "premiera", href: "/premiera", label: "Premiera na żywo", icon: "live", key: "l", phase: 2 },
  { id: "ustawienia", href: "/ustawienia", label: "Ustawienia", icon: "settings", key: ",", phase: 4 },
];

export const ALL_NAV = [...NAV, ...NAV_FOOT];

/** Which nav item a path belongs to ("/" only for the exact root). */
export function activeNavId(pathname: string): string | null {
  if (pathname === "/") return "dzisiaj";
  const hit = ALL_NAV.find((n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
  return hit?.id ?? null;
}

/** Bottom bar on phones, as approved (DESIGN-SYSTEM.md 5): Dzisiaj, Skrzynka, Treści, Przychody + "Więcej". */
export const BOTTOM_NAV: { id: string; href: string; label: string; icon: IconName; count?: NavItem["count"] }[] = [
  { id: "dzisiaj", href: "/", label: "Dzisiaj", icon: "today" },
  { id: "spolecznosc", href: "/spolecznosc", label: "Skrzynka", icon: "inbox", count: "moderation" },
  { id: "tresci", href: "/tresci", label: "Treści", icon: "film" },
  { id: "przychody", href: "/przychody", label: "Przychody", icon: "coins" },
];
