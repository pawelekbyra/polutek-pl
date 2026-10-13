import type { Actor } from "@/lib/modules/shared/actor";

/**
 * Who is asking, in authorization terms. `staff` is a platform administrator (today `Actor.type === "admin"`:
 * the panel account, or the legacy ADMIN role on www). It is deliberately a different word so that "admin"
 * stops meaning three things (CLAUDE.md 4.23).
 */
export type Principal =
  | { kind: "guest" }
  | { kind: "user"; userId: string; onboardingPending: boolean }
  | { kind: "staff"; staffId: string }
  | { kind: "system"; reason: string };

export function toPrincipal(actor: Actor): Principal {
  switch (actor.type) {
    case "guest":
      return { kind: "guest" };
    case "user":
      return { kind: "user", userId: actor.userId, onboardingPending: actor.onboardingPending === true };
    case "admin":
      return { kind: "staff", staffId: actor.userId };
    case "system":
      return { kind: "system", reason: actor.reason };
  }
}
