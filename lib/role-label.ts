import type { Tx } from "@/lib/i18n/ui";
import type { RoleBadgeKind } from "@/lib/role-badge";

/** The spoken/written name of a role, with the interface texts the comment badges already use (no new catalog entries). */
export function roleLabel(kind: RoleBadgeKind, tx: Tx): string {
  if (kind === "AUTHOR") return tx("Twórca", "Creator");
  if (kind === "VIP") return tx("Użytkownik VIP", "VIP user");
  return tx("Normik", "Base");
}
