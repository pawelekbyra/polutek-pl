"use client";
import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, type Theme } from "./shell/theme";

const OPTIONS: [Theme, string][] = [
  ["system", "Jak w systemie (domyślnie)"],
  ["light", "Jasny"],
  ["dark", "Ciemny"],
];

function subscribe(cb: () => void) {
  window.addEventListener("pp-admin-theme", cb);
  return () => window.removeEventListener("pp-admin-theme", cb);
}

/** Theme choice remembered in this browser only (no server state). */
export function ThemeChoice() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "system");
  return (
    <fieldset className="field fieldset-plain">
      <legend className="field-label">Motyw</legend>
      {OPTIONS.map(([value, label]) => (
        <label key={value} className="choice">
          <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => applyTheme(value)} /> {label}
        </label>
      ))}
    </fieldset>
  );
}
