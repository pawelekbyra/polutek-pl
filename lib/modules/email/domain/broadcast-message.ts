import { escapeHtml } from "./email-content";
import { BROADCAST_TEMPLATE_DEFINITION } from "./email-template-registry";
import { renderHtml, renderSubject } from "./render-email";

export type BroadcastContent = {
  subjectPl: string;
  htmlPl: string;
  subjectEn: string;
  htmlEn: string;
};

export type BroadcastRecipientValues = {
  language: "pl" | "en";
  nickname: string | null;
  email: string;
  appName: string;
  brandName: string;
  appUrl: string;
  /** Visible unsubscribe link (the confirmation page). */
  unsubscribePageUrl: string;
};

const FOOTER_STYLE =
  "max-width:600px;margin:16px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#777777;text-align:center;";

/**
 * The footer every broadcast gets, whatever the admin wrote: why the person receives it and a
 * one-click way out (PKE / GDPR art. 21, Gmail and Yahoo bulk-sender rules).
 */
export function buildBroadcastFooter(language: "pl" | "en", brandName: string, unsubscribePageUrl: string): string {
  const href = escapeHtml(unsubscribePageUrl);
  const brand = escapeHtml(brandName);
  const text =
    language === "en"
      ? `You receive this email because you turned on notifications about new content at ${brand}. <a href="${href}" style="color:#777777;">Unsubscribe</a>`
      : `Dostajesz tę wiadomość, bo włączono powiadomienia o nowych treściach w ${brand}. <a href="${href}" style="color:#777777;">Wypisz się</a>`;
  return `<p style="${FOOTER_STYLE}">${text}</p>`;
}

/** Language version for one recipient; an empty English version falls back to Polish. */
export function renderBroadcastMessage(content: BroadcastContent, values: BroadcastRecipientValues) {
  const useEnglish = values.language === "en" && content.subjectEn.trim() !== "" && content.htmlEn.trim() !== "";
  const subjectTemplate = useEnglish ? content.subjectEn : content.subjectPl;
  const htmlTemplate = useEnglish ? content.htmlEn : content.htmlPl;
  const language = useEnglish ? "en" : "pl";

  const filled: Record<string, string> = {
    firstName: values.nickname?.trim() || (language === "en" ? "there" : "Przyjacielu"),
    email: values.email,
    appName: values.appName,
    brandName: values.brandName,
    appUrl: values.appUrl,
    unsubscribeLink: values.unsubscribePageUrl,
    preferencesLink: values.unsubscribePageUrl,
  };
  const allowed = Object.fromEntries(BROADCAST_TEMPLATE_DEFINITION.variables.map((key) => [key, filled[key] ?? ""]));

  return {
    language: language as "pl" | "en",
    subject: renderSubject(subjectTemplate, allowed),
    html: renderHtml(htmlTemplate, allowed),
    footerHtml: buildBroadcastFooter(language, values.brandName, values.unsubscribePageUrl),
  };
}
