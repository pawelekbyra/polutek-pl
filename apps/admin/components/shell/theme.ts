"use client";
/** Theme choice: follows the system by default; "light"/"dark" is remembered in this browser only. */
import { THEME_STORAGE_KEY as THEME_KEY } from "@admin/lib/theme-boot";

export type Theme = "system" | "light" | "dark";
export const THEME_NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
export const THEME_NAME: Record<Theme, string> = { system: "systemowy", light: "jasny", dark: "ciemny" };

export function readTheme(): Theme {
  if (typeof document === "undefined") return "system";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(t: Theme) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // Without storage the choice simply lasts until the tab closes.
  }
  window.dispatchEvent(new CustomEvent("pp-admin-theme", { detail: t }));
}
