/**
 * Pure rules of the creator's right to appeal a moderation decision (DSA art. 20). No I/O, no clock: callers pass
 * the time. The decision itself stays immutable (database trigger); an appeal outcome is a NEW decision.
 */

/** The appeal window: six months from the decision (calendar months, UTC). */
export const APPEAL_WINDOW_MONTHS = 6;
export const APPEAL_TEXT_MIN = 20;
export const APPEAL_TEXT_MAX = 2000;

/** Actions written by the appeal outcome itself; they are shown as the result of an appeal, never appealed again. */
export const APPEAL_OUTCOME_ACTIONS = ["APPEAL_UPHELD", "APPEAL_REJECTED"] as const;

/** A dismissed report is the reporter's matter, not a decision against the creator. */
const NOT_AGAINST_CREATOR = new Set<string>(["REPORT_DISMISSED"]);

export function isAppealOutcomeAction(action: string): boolean {
  return (APPEAL_OUTCOME_ACTIONS as readonly string[]).includes(action);
}

/** Decisions the creator sees in the Studio list (everything that restricted something of theirs). */
export function isDecisionVisibleToCreator(action: string): boolean {
  return !NOT_AGAINST_CREATOR.has(action) && !isAppealOutcomeAction(action);
}

export function appealDeadline(decisionCreatedAt: Date): Date {
  const d = new Date(decisionCreatedAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + APPEAL_WINDOW_MONTHS);
  return d;
}

export function isAppealWindowOpen(decisionCreatedAt: Date, now: Date): boolean {
  return now.getTime() <= appealDeadline(decisionCreatedAt).getTime();
}

export type AppealTextCheck = { ok: true; text: string } | { ok: false; message: string };

export function checkAppealText(raw: string): AppealTextCheck {
  const text = raw.trim();
  if (text.length < APPEAL_TEXT_MIN) return { ok: false, message: `Opisz, dlaczego się odwołujesz (co najmniej ${APPEAL_TEXT_MIN} znaków).` };
  if (text.length > APPEAL_TEXT_MAX) return { ok: false, message: `Odwołanie jest za długie (najwyżej ${APPEAL_TEXT_MAX} znaków).` };
  return { ok: true, text };
}

const ACTION_LABELS: Record<string, string> = {
  CHANNEL_ACTIVE: "Kanał przywrócony do pełnej aktywności",
  CHANNEL_LIMITED: "Możliwości kanału zostały ograniczone",
  CHANNEL_SUSPENDED: "Kanał został zawieszony",
  CHANNEL_BANNED: "Kanał został zablokowany",
  CHANNEL_STRIKE_ISSUED: "Kanał otrzymał ostrzeżenie",
  VIDEO_VISIBLE: "Film przywrócony do pełnej widoczności",
  VIDEO_LIMITED: "Zasięg filmu został ograniczony",
  VIDEO_AGE_RESTRICTED: "Film oznaczony jako tylko dla zalogowanych (ograniczenie wieku)",
  VIDEO_REMOVED: "Film został usunięty przez moderację",
  REPORT_ACTION_TAKEN: "Zgłoszenie dotyczące Twojej treści zostało uwzględnione",
  APPEAL_UPHELD: "Odwołanie zostało uwzględnione",
  APPEAL_REJECTED: "Odwołanie zostało oddalone",
};

/** Polish description of a decision's action; unknown actions get a neutral label, never the raw code. */
export function describeDecisionAction(action: string): string {
  return ACTION_LABELS[action] ?? "Decyzja moderacyjna";
}

/** Notification and mail headline for a decision made now (same wording as the Studio list). */
export const describeDecisionHeadline = describeDecisionAction;

export const APPEAL_STATUS_LABEL: Record<string, string> = {
  PENDING: "Czeka na rozpatrzenie",
  UPHELD: "Uwzględnione",
  REJECTED: "Oddalone",
};

/** Heavy decisions reach the owner even when moderation notifications are switched off. */
export function isAlwaysNotifiedAction(action: string): boolean {
  return action === "CHANNEL_SUSPENDED" || action === "CHANNEL_BANNED" || action === "VIDEO_REMOVED" || action === "CHANNEL_LIMITED";
}
