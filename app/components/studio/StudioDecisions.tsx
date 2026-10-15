"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { StudioApiError, jsonBody, studioApi } from "./studio-client";
import { Badge, CharCounter, Card, Field, Notice, inputClass, smallButtonClass, smallGhostButtonClass } from "./ui";

type AppealState = {
  id: string;
  status: "PENDING" | "UPHELD" | "REJECTED";
  createdAt: string;
  resolvedAt: string | null;
  outcomeReasonPublic: string | null;
};

type DecisionRow = {
  id: string;
  createdAt: string;
  action: string;
  targetType: string;
  targetLabel: string | null;
  reasonPublic: string;
  appealable: boolean;
  appealBlockedReason: string | null;
  appealDeadline: string;
  appeal: AppealState | null;
};

const APPEAL_MIN = 20;
const APPEAL_MAX = 2000;

/**
 * Studio -> "Decisions and appeals" (DSA art. 17 and 20): what the platform decided about the channel and its
 * videos, the public reasons, and an appeal form (once per decision, within six months). The server never sends
 * internal notes; this component only shows what `/api/studio/moderation` returns.
 */
export default function StudioDecisions() {
  const { tx, language } = useLanguage();
  const [items, setItems] = useState<DecisionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await studioApi<{ items: DecisionRow[] }>("/api/studio/moderation");
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wczytać decyzji.", "Could not load the decisions."));
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const actionLabel = (action: string): string => {
    switch (action) {
      case "CHANNEL_ACTIVE":
        return tx("Kanał przywrócony do pełnej aktywności", "Channel restored to full activity");
      case "CHANNEL_LIMITED":
        return tx("Możliwości kanału zostały ograniczone", "Your channel's features were limited");
      case "CHANNEL_SUSPENDED":
        return tx("Kanał został zawieszony", "Your channel was suspended");
      case "CHANNEL_BANNED":
        return tx("Kanał został zablokowany", "Your channel was banned");
      case "CHANNEL_STRIKE_ISSUED":
        return tx("Kanał otrzymał ostrzeżenie", "Your channel received a warning");
      case "VIDEO_VISIBLE":
        return tx("Film przywrócony do pełnej widoczności", "Video restored to full visibility");
      case "VIDEO_LIMITED":
        return tx("Zasięg filmu został ograniczony", "The video's reach was limited");
      case "VIDEO_AGE_RESTRICTED":
        return tx("Film tylko dla zalogowanych (ograniczenie wieku)", "Video limited to signed-in viewers (age restriction)");
      case "VIDEO_REMOVED":
        return tx("Film został usunięty przez moderację", "The video was removed by moderation");
      case "REPORT_ACTION_TAKEN":
        return tx("Zgłoszenie dotyczące Twojej treści zostało uwzględnione", "A report about your content was upheld");
      default:
        return tx("Decyzja moderacyjna", "Moderation decision");
    }
  };

  const statusLabel = (status: AppealState["status"]): string =>
    status === "PENDING" ? tx("Czeka na rozpatrzenie", "Awaiting review") : status === "UPHELD" ? tx("Uwzględnione", "Upheld") : tx("Oddalone", "Rejected");

  const date = (iso: string) => new Date(iso).toLocaleDateString(language);

  const submit = async (decisionId: string) => {
    setBusy(true);
    setError(null);
    try {
      await studioApi(`/api/studio/moderation/${encodeURIComponent(decisionId)}/appeal`, { method: "POST", ...jsonBody({ text }) });
      setOpenId(null);
      setText("");
      setDone(tx("Odwołanie zostało wysłane. Rozpatrzy je człowiek, a o wyniku dostaniesz powiadomienie.", "Your appeal was sent. A person will review it and you will be notified of the result."));
      await load();
    } catch (e) {
      setError(e instanceof StudioApiError ? e.message : tx("Nie udało się wysłać odwołania.", "Could not send the appeal."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={tx("Decyzje i odwołania", "Decisions and appeals")}>
      <p className="mb-3 text-[14px] text-[var(--chan-muted)]">
        {tx(
          "Tu widzisz decyzje platformy dotyczące Twojego kanału i filmów razem z uzasadnieniem. Z każdą możesz się odwołać raz, w ciągu 6 miesięcy.",
          "Here you see the platform's decisions about your channel and videos, with the reasons. You can appeal each one once, within 6 months.",
        )}
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {done && <Notice kind="success">{done}</Notice>}
      {!items && !error && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>}
      {items && items.length === 0 && <p className="text-[14px] text-[var(--chan-muted)]">{tx("Brak decyzji dotyczących Twojego kanału.", "There are no decisions about your channel.")}</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-[var(--chan-line)]">
          {items.map((d) => (
            <li key={d.id} className="grid gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--chan-muted)]">
                <strong className="text-[14px] text-[var(--chan-ink)]">{actionLabel(d.action)}</strong>
                <span>· {date(d.createdAt)}</span>
                {d.targetLabel && <span>· {d.targetLabel}</span>}
                {d.appeal && <Badge tone={d.appeal.status === "UPHELD" ? "good" : "warn"}>{statusLabel(d.appeal.status)}</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-[var(--chan-ink)]">{d.reasonPublic}</p>
              <p className="text-[12px] text-[var(--chan-muted)]">{tx("Identyfikator decyzji: {0}", "Decision ID: {0}", d.id)}</p>
              {d.appeal?.outcomeReasonPublic && (
                <Notice>
                  {tx("Odpowiedź na odwołanie: {0}", "Response to your appeal: {0}", d.appeal.outcomeReasonPublic)}
                </Notice>
              )}
              {d.appealable && openId !== d.id && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={smallGhostButtonClass}
                    onClick={() => {
                      setOpenId(d.id);
                      setText("");
                      setDone(null);
                    }}
                  >
                    {tx("Odwołaj się", "Appeal")}
                  </button>
                  <span className="text-[12px] text-[var(--chan-muted)]">{tx("Termin: do {0}", "Deadline: {0}", date(d.appealDeadline))}</span>
                </div>
              )}
              {!d.appealable && d.appealBlockedReason && !d.appeal && <p className="text-[12px] text-[var(--chan-muted)]">{d.appealBlockedReason}</p>}
              {openId === d.id && (
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(d.id);
                  }}
                >
                  <Field
                    label={tx("Dlaczego się odwołujesz?", "Why are you appealing?")}
                    htmlFor={`appeal-${d.id}`}
                    counter={<CharCounter id={`appeal-${d.id}-count`} value={text} max={APPEAL_MAX} />}
                    hint={tx("Od 20 do 2000 znaków. Napisz, co Twoim zdaniem zostało źle ocenione.", "20 to 2000 characters. Say what you think was judged wrongly.")}
                  >
                    <textarea
                      id={`appeal-${d.id}`}
                      className={inputClass}
                      rows={5}
                      maxLength={APPEAL_MAX}
                      value={text}
                      aria-describedby={`appeal-${d.id}-hint appeal-${d.id}-count`}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={smallButtonClass} disabled={busy || text.trim().length < APPEAL_MIN}>
                      {busy ? tx("Wysyłam…", "Sending…") : tx("Wyślij odwołanie", "Send appeal")}
                    </button>
                    <button type="button" className={smallGhostButtonClass} disabled={busy} onClick={() => setOpenId(null)}>
                      {tx("Anuluj", "Cancel")}
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
