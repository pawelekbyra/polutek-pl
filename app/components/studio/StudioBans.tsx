"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { jsonBody, studioApi } from "./studio-client";
import { studioErrorText } from "./studio-errors";
import { Card, Notice, inputClass, smallButtonClass, smallDangerGhostButtonClass, smallGhostButtonClass } from "./ui";

/** Both pieces talk through this event, so blocking in the comment list refreshes the block list below it. */
const BANS_CHANGED = "studio-bans-changed";

type BanRow = { userId: string; name: string | null; until: string | null; reason: string | null; createdAt: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Block user" for one comment author (Studio -> Comments): the viewer can still watch but cannot comment under the
 * channel's videos. Optional end date and a reason that only the channel sees.
 */
export function BlockViewerButton({ userId, name }: { userId: string; name: string }) {
  const { tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const until = Number(days) > 0 ? new Date(Date.now() + Number(days) * DAY_MS).toISOString() : null;
      await studioApi("/api/studio/bans", { method: "POST", ...jsonBody({ userId, until, reason: reason.trim() || null }) });
      setOpen(false);
      setReason("");
      setMessage({ kind: "success", text: tx("Użytkownik został zablokowany.", "The user was blocked.") });
      window.dispatchEvent(new Event(BANS_CHANGED));
    } catch (e) {
      setMessage({ kind: "error", text: studioErrorText(e, tx, tx("Nie udało się zablokować użytkownika.", "Could not block the user.")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={smallDangerGhostButtonClass} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {tx("Zablokuj użytkownika", "Block user")}
      </button>
      {message && !open && <Notice kind={message.kind}>{message.text}</Notice>}
      {open && (
        <div className="grid w-full gap-2 rounded-xl border border-[var(--chan-line)] p-3">
          <p className="text-[13px] text-[var(--chan-ink)]">
            {tx("{0} będzie mógł oglądać Twoje filmy, ale nie skomentuje ich ani nie odpowie na komentarze.", "{0} will still be able to watch your videos but will not be able to comment or reply.", name)}
          </p>
          <label className="grid gap-1 text-[13px] font-semibold text-[var(--chan-ink)]">
            {tx("Na jak długo", "For how long")}
            <select className={inputClass} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="1">{tx("1 dzień", "1 day")}</option>
              <option value="7">{tx("7 dni", "7 days")}</option>
              <option value="30">{tx("30 dni", "30 days")}</option>
              <option value="0">{tx("Bezterminowo", "Until further notice")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-[13px] font-semibold text-[var(--chan-ink)]">
            {tx("Powód (widzisz go tylko Ty)", "Reason (only you see it)")}
            <input className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallButtonClass} disabled={busy} onClick={() => void submit()}>
              {busy ? tx("Zapisuję…", "Saving…") : tx("Zablokuj", "Block")}
            </button>
            <button type="button" className={smallGhostButtonClass} disabled={busy} onClick={() => setOpen(false)}>
              {tx("Anuluj", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** The channel's block list with "Unblock". Renders nothing until there is something to show. */
export function BlockedViewersCard() {
  const { tx, language } = useLanguage();
  const [items, setItems] = useState<BanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await studioApi<{ items: BanRow[] }>("/api/studio/bans");
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(studioErrorText(e, tx, tx("Nie udało się wczytać zablokowanych użytkowników.", "Could not load the blocked users.")));
    }
  }, [tx]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(BANS_CHANGED, onChange);
    return () => window.removeEventListener(BANS_CHANGED, onChange);
  }, [load]);

  const unblock = async (userId: string) => {
    setBusyId(userId);
    try {
      await studioApi("/api/studio/bans", { method: "DELETE", ...jsonBody({ userId }) });
      await load();
    } catch (e) {
      setError(studioErrorText(e, tx, tx("Nie udało się odblokować użytkownika.", "Could not unblock the user.")));
    } finally {
      setBusyId(null);
    }
  };

  if (!error && (!items || items.length === 0)) return null;
  return (
    <Card title={tx("Zablokowani użytkownicy", "Blocked users")}>
      {error && <Notice kind="error">{error}</Notice>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-[var(--chan-line)]">
          {items.map((b) => (
            <li key={b.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-[14px] text-[var(--chan-ink)]">
                <strong>{b.name ?? tx("Użytkownik", "User")}</strong>
                <span className="ml-2 text-[12px] text-[var(--chan-muted)]">
                  {b.until ? tx("do {0}", "until {0}", new Date(b.until).toLocaleDateString(language)) : tx("bezterminowo", "until further notice")}
                </span>
                {b.reason && <p className="text-[12px] text-[var(--chan-muted)]">{b.reason}</p>}
              </div>
              <button type="button" className={smallGhostButtonClass} disabled={busyId === b.userId} onClick={() => void unblock(b.userId)}>
                {tx("Odblokuj", "Unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
