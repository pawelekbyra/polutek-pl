"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import {
  CHANNEL_CONTACT_EMAIL_MAX,
  CHANNEL_LINKS_MAX,
  CHANNEL_LINK_TITLE_MAX,
  CHANNEL_LINK_URL_MAX,
  normalizeChannelLinks,
  normalizeContactEmail,
  type ChannelAboutProblem,
} from "@/lib/modules/channel/domain/channel-about";
import { BANNER_ACCEPT, BANNER_MAX_FILE_BYTES, validateBannerFile } from "@/lib/modules/channel/domain/channel-banner-limits";
import { jsonBody, studioApi, type StudioChannelAbout } from "./studio-client";
import { studioErrorText } from "./studio-errors";
import { fileToBannerDataUrl } from "./banner-image";
import { Card, Field, Notice, buttonClass, inputClass, smallDangerGhostButtonClass, smallGhostButtonClass, ghostButtonClass } from "./ui";

type Row = { title: string; url: string };

/** Studio -> Channel and settings: banner image, About links and the optional public contact e-mail. */
export default function StudioChannelAbout({ onChanged }: { onChanged?: () => void }) {
  const { tx } = useLanguage();
  const [loaded, setLoaded] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const about = await studioApi<StudioChannelAbout>("/api/studio/channel/about");
      setBannerUrl(about.bannerUrl);
      setRows(about.links.map((l) => ({ title: l.title, url: l.url })));
      setEmail(about.contactEmail ?? "");
      setLoaded(true);
    } catch (e) {
      setMessage({ kind: "error", text: studioErrorText(e, tx, tx("Nie udało się wczytać danych kanału.", "Could not load the channel data.")) });
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const problemText = (problem: ChannelAboutProblem): string => {
    switch (problem) {
      case "TOO_MANY_LINKS":
        return tx("Możesz dodać najwyżej {0} linków.", "You can add at most {0} links.", CHANNEL_LINKS_MAX);
      case "LINK_TITLE":
        return tx("Każdy link potrzebuje nazwy (najwyżej {0} znaków).", "Every link needs a name (at most {0} characters).", CHANNEL_LINK_TITLE_MAX);
      case "LINK_NOT_HTTPS":
        return tx("Linki muszą zaczynać się od https://.", "Links must start with https://.");
      case "LINK_HOST":
        return tx("Ten adres linku nie jest dozwolony.", "This link address is not allowed.");
      case "LINK_DUPLICATE":
        return tx("Ten sam link jest dodany dwa razy.", "The same link is added twice.");
      case "EMAIL":
        return tx("Adres e-mail do kontaktu jest niepoprawny.", "The contact e-mail address is not valid.");
      default:
        return tx("Adres linku jest niepoprawny.", "The link address is not valid.");
    }
  };

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      onChanged?.();
    } catch (e) {
      setMessage({ kind: "error", text: studioErrorText(e, tx, tx("Nie udało się zapisać zmian.", "Could not save the changes.")) });
    } finally {
      setBusy(null);
    }
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateBannerFile(file);
    if (problem === "type") {
      setMessage({ kind: "error", text: tx("Baner: dozwolone pliki JPG, PNG lub WebP.", "Banner: JPG, PNG or WebP files only.") });
      return;
    }
    if (problem === "size") {
      setMessage({ kind: "error", text: tx("Baner może mieć najwyżej {0} MB.", "The banner can be at most {0} MB.", BANNER_MAX_FILE_BYTES / (1024 * 1024)) });
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await fileToBannerDataUrl(file);
    } catch {
      setMessage({ kind: "error", text: tx("Nie udało się przetworzyć obrazu. Wybierz inny plik.", "Could not process the image. Pick another file.") });
      return;
    }
    setPreview(dataUrl);
    await run(
      "banner",
      async () => {
        const result = await studioApi<{ bannerUrl: string | null }>("/api/studio/channel/banner", { method: "PUT", ...jsonBody({ dataUrl }) });
        setBannerUrl(result.bannerUrl);
        setPreview(null);
      },
      tx("Baner zapisany.", "Banner saved."),
    );
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeBanner = () =>
    run(
      "banner-remove",
      async () => {
        await studioApi("/api/studio/channel/banner", { method: "DELETE" });
        setBannerUrl(null);
      },
      tx("Baner usunięty.", "Banner removed."),
    );

  const updateRow = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const saveAbout = () => {
    const links = normalizeChannelLinks(rows);
    if (!links.ok) {
      setMessage({ kind: "error", text: problemText(links.problem) });
      return;
    }
    const mail = normalizeContactEmail(email);
    if (!mail.ok) {
      setMessage({ kind: "error", text: problemText(mail.problem) });
      return;
    }
    return run(
      "about",
      async () => {
        const saved = await studioApi<StudioChannelAbout>("/api/studio/channel/about", { method: "PATCH", ...jsonBody({ links: links.links, contactEmail: mail.email }) });
        setRows(saved.links.map((l) => ({ title: l.title, url: l.url })));
        setEmail(saved.contactEmail ?? "");
      },
      tx("Sekcja „O kanale” zapisana.", "The About section was saved."),
    );
  };

  const shownBanner = preview ?? bannerUrl;

  return (
    <div className="grid gap-4">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <Card title={tx("Baner kanału", "Channel banner")}>
        <div className="grid max-w-2xl gap-3">
          <div
            className="aspect-[3/1] w-full overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface)] sm:aspect-[4/1]"
            aria-live="polite"
          >
            {shownBanner ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownBanner} alt={tx("Podgląd baneru kanału", "Channel banner preview")} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-[var(--chan-muted)]">
                {loaded ? tx("Kanał nie ma baneru.", "The channel has no banner.") : tx("Wczytywanie…", "Loading…")}
              </div>
            )}
          </div>
          <p className="text-[13px] text-[var(--chan-muted)]">
            {tx(
              "Proporcje 4:1 (zalecane 1280×320 px). Obraz zostanie przycięty do środka. JPG, PNG lub WebP, do {0} MB.",
              "4:1 ratio (1280×320 px recommended). The image is cropped around the centre. JPG, PNG or WebP, up to {0} MB.",
              BANNER_MAX_FILE_BYTES / (1024 * 1024),
            )}
          </p>
          <input
            ref={fileInput}
            id="ch-banner-file"
            type="file"
            accept={BANNER_ACCEPT}
            className="sr-only"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor="ch-banner-file"
              className={`${buttonClass} cursor-pointer ${busy !== null ? "pointer-events-none opacity-50" : ""}`}
            >
              {bannerUrl ? tx("Zmień baner", "Replace banner") : tx("Dodaj baner", "Add banner")}
            </label>
            {bannerUrl && (
              <button type="button" className={ghostButtonClass} disabled={busy !== null} onClick={() => void removeBanner()}>
                {tx("Usuń baner", "Remove banner")}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title={tx("O kanale", "About the channel")}>
        <div className="grid max-w-2xl gap-4">
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-[var(--chan-ink)]">{tx("Linki", "Links")}</legend>
            <p className="text-[13px] text-[var(--chan-muted)]">
              {tx(
                "Do {0} linków, tylko https://. Pojawią się na karcie „O kanale” z atrybutem nofollow.",
                "Up to {0} links, https:// only. They appear on the About tab with the nofollow attribute.",
                CHANNEL_LINKS_MAX,
              )}
            </p>
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-[var(--chan-line)] p-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-center">
                <input
                  className={inputClass}
                  value={row.title}
                  maxLength={CHANNEL_LINK_TITLE_MAX}
                  placeholder={tx("Nazwa", "Name")}
                  aria-label={tx("Nazwa linku {0}", "Name of link {0}", index + 1)}
                  onChange={(e) => updateRow(index, { title: e.target.value })}
                />
                <input
                  className={inputClass}
                  value={row.url}
                  maxLength={CHANNEL_LINK_URL_MAX}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="https://"
                  aria-label={tx("Adres linku {0}", "Address of link {0}", index + 1)}
                  onChange={(e) => updateRow(index, { url: e.target.value })}
                />
                <button type="button" className={smallDangerGhostButtonClass} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                  {tx("Usuń", "Remove")}
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className={smallGhostButtonClass}
                disabled={rows.length >= CHANNEL_LINKS_MAX}
                onClick={() => setRows((current) => [...current, { title: "", url: "https://" }])}
              >
                {tx("Dodaj link", "Add link")}
              </button>
            </div>
          </fieldset>

          <Field
            label={tx("Publiczny e-mail do kontaktu (opcjonalnie)", "Public contact e-mail (optional)")}
            htmlFor="ch-contact-email"
            hint={tx(
              "Zostanie pokazany wszystkim na karcie „O kanale”. Zostaw puste, aby go nie pokazywać. To nie jest e-mail Twojego konta.",
              "Shown to everyone on the About tab. Leave empty to show nothing. This is not your account e-mail.",
            )}
          >
            <input
              id="ch-contact-email"
              className={inputClass}
              type="email"
              value={email}
              maxLength={CHANNEL_CONTACT_EMAIL_MAX}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <div>
            <button type="button" className={buttonClass} disabled={busy !== null || !loaded} onClick={() => void saveAbout()}>
              {tx("Zapisz sekcję „O kanale”", "Save the About section")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
