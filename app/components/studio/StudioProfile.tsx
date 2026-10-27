"use client";

import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { jsonBody, studioApi, type StudioChannel } from "./studio-client";
import { studioErrorText } from "./studio-errors";
import StudioChannelAbout from "./StudioChannelAbout";
import { Card, Field, Notice, buttonClass, dangerButtonClass, inputClass } from "./ui";

/** Studio -> Channel and settings: name, bio, handle and the channel deletion. */
export default function StudioProfile({ channel, onChanged }: { channel: StudioChannel; onChanged: () => void }) {
  const { tx } = useLanguage();
  const [name, setName] = useState(channel.name);
  const [bio, setBio] = useState(channel.bio ?? "");
  const [handle, setHandle] = useState(channel.handle ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      onChanged();
    } catch (e) {
      setMessage({ kind: "error", text: studioErrorText(e, tx, tx("Nie udało się zapisać zmian.", "Could not save the changes.")) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <Card title={tx("Profil kanału", "Channel profile")}>
        <div className="grid max-w-xl gap-4">
          <Field
            label={tx("Nazwa kanału", "Channel name")}
            htmlFor="pr-name"
            hint={tx("Nazwę można zmienić najwyżej dwa razy na 14 dni.", "You can change the name at most twice in 14 days.")}
          >
            <input id="pr-name" className={inputClass} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={tx("Opis kanału", "Channel description")} htmlFor="pr-bio" hint={tx("Do 1000 znaków.", "Up to 1000 characters.")}>
            <textarea id="pr-bio" className={inputClass} rows={4} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <div>
            <button
              type="button"
              className={buttonClass}
              disabled={busy !== null || !name.trim()}
              onClick={() =>
                run(
                  "profile",
                  () => studioApi("/api/studio/channel", { method: "PATCH", ...jsonBody({ name, ...(bio.trim() !== (channel.bio ?? "").trim() ? { bio: bio.trim() === "" ? null : bio } : {}) }) }),
                  tx("Profil zapisany.", "Profile saved."),
                )
              }
            >
              {tx("Zapisz profil", "Save profile")}
            </button>
          </div>
        </div>
      </Card>

      <StudioChannelAbout />

      <Card title={tx("Uchwyt", "Handle")}>
        <div className="grid max-w-xl gap-4">
          <Field
            label={tx("Uchwyt kanału", "Channel handle")}
            htmlFor="pr-handle"
            hint={tx(
              "Stary uchwyt zostaje zarezerwowany i przekierowuje na nowy przez 180 dni. Zmiana najwyżej dwa razy na 14 dni.",
              "The old handle stays reserved and redirects to the new one for 180 days. At most two changes in 14 days.",
            )}
          >
            <input
              id="pr-handle"
              className={inputClass}
              value={handle}
              maxLength={30}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value)}
            />
          </Field>
          <div>
            <button
              type="button"
              className={buttonClass}
              disabled={busy !== null || handle.trim().length < 3 || handle.trim().toLowerCase() === (channel.handle ?? "")}
              onClick={() =>
                run("handle", () => studioApi("/api/studio/channel/handle", { method: "PUT", ...jsonBody({ handle }) }), tx("Uchwyt zmieniony.", "Handle changed."))
              }
            >
              {tx("Zmień uchwyt", "Change handle")}
            </button>
          </div>
        </div>
      </Card>

      <Card title={tx("Usuń kanał", "Delete channel")}>
        <div className="grid max-w-xl gap-3">
          <p className="text-[14px] text-[var(--chan-muted)]">
            {tx(
              "Kanał znika od razu. Przez 30 dni możesz go przywrócić, potem zostanie usunięty na stałe. Wpisz nazwę kanału, aby potwierdzić.",
              "The channel disappears at once. You can restore it for 30 days, then it is deleted for good. Type the channel name to confirm.",
            )}
          </p>
          <input className={inputClass} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} aria-label={tx("Nazwa kanału", "Channel name")} />
          <div>
            <button
              type="button"
              className={dangerButtonClass}
              disabled={busy !== null || confirmDelete.trim() !== channel.name.trim()}
              onClick={() => run("delete", () => studioApi("/api/studio/channel", { method: "DELETE" }), tx("Kanał usunięty. Możesz go przywrócić przez 30 dni.", "Channel deleted. You can restore it for 30 days."))}
            >
              {tx("Usuń kanał", "Delete channel")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
