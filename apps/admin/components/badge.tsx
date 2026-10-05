/**
 * Badge on its own so that client components can use it without pulling the whole module barrel
 * (lib/modules/admin-overview re-exports server code, including the Postgres driver, which must never reach the browser bundle).
 * Only TYPES are imported from the module here: they are erased at build time.
 */
import type { ReactNode } from "react";
import type { StateKind } from "@/lib/modules/admin-overview";
import { Icon, type IconName } from "./icons";

const STATE_ICON: Record<StateKind, IconName> = { ok: "ok", warn: "warn", crit: "crit", info: "info" };

export function Badge({ kind, children, icon }: { kind?: StateKind | "outline" | ""; children: ReactNode; icon?: IconName | false }) {
  const iconName = icon === false ? null : icon ?? (kind && kind !== "outline" ? STATE_ICON[kind] : null);
  return (
    <span className={`badge ${kind ?? ""}`}>
      {iconName ? <Icon name={iconName} /> : null}
      {children}
    </span>
  );
}
