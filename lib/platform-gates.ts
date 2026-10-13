/**
 * Platform gates (docs/architecture/multi-creator-platform.md, CLAUDE.md 1 and 4.14).
 *
 * Capabilities that need a legal or operational decision before they may run are switched here, not by a deploy:
 * every gate is OFF unless its environment variable says otherwise, so an unconfigured server behaves exactly like
 * the single-channel site. Only the owner turns a gate on, after the matching checklist in the architecture doc.
 *
 * - `channelCreation`: `off` (nobody), `invite` (accounts on the invite list), `on` (every signed-in account).
 * - `sales`: `off` | `on`. Paid access, orders and refunds. Needs the legal entity, VAT registration, terms, Stripe approval.
 * - `payouts`: `off` | `on`. Moving creators' shares out. Needs `sales` and the creator tax profiles.
 */
export type PlatformGate = "channelCreation" | "sales" | "payouts";
export type GateMode = "off" | "invite" | "on";

const ENV_NAMES: Record<PlatformGate, string> = {
  channelCreation: "PLATFORM_GATE_CHANNEL_CREATION",
  sales: "PLATFORM_GATE_SALES",
  payouts: "PLATFORM_GATE_PAYOUTS",
};

/** `invite` is only meaningful for `channelCreation`; for the others it is read as `off`. */
const ALLOWED_MODES: Record<PlatformGate, readonly GateMode[]> = {
  channelCreation: ["off", "invite", "on"],
  sales: ["off", "on"],
  payouts: ["off", "on"],
};

export function gateMode(gate: PlatformGate, env: Record<string, string | undefined> = process.env): GateMode {
  const raw = env[ENV_NAMES[gate]]?.trim().toLowerCase();
  if (raw && (ALLOWED_MODES[gate] as readonly string[]).includes(raw)) return raw as GateMode;
  return "off";
}

/** True when the gate lets anyone through (`on`). `invite` is not "open": callers must check the invite list. */
export function isGateOpen(gate: PlatformGate, env: Record<string, string | undefined> = process.env): boolean {
  return gateMode(gate, env) === "on";
}

export const PLATFORM_GATE_ENV = ENV_NAMES;
