/**
 * Integration status for Ustawienia: which outside services this panel process is configured for and the last
 * time each one did something. NEVER values of secrets: only "set / not set", the mode of a Stripe key (read
 * from its public prefix) and timestamps from our own tables. No call to Stripe, the mail provider or Cloudflare is made.
 */
import { getSnsConfig } from "@/lib/email-config";
import type { AppContext } from "@/lib/modules/shared/app-context";
import type { StateKind } from "../domain/types";

export type IntegrationCheck = {
  id: string;
  label: string;
  kind: StateKind;
  detail: string;
  /** Last proof the integration works, from our own tables (ISO) or null. */
  lastAt: string | null;
  lastLabel?: string;
};

type Env = Record<string, string | undefined>;
export type IntegrationLast = { stripeEventAt: Date | null; emailEventAt: Date | null; paymentAt: Date | null; broadcastAt: Date | null };

const has = (env: Env, name: string) => !!env[name]?.trim();

/** "sk_live_…" / "rk_live_…" = live, "…_test_…" = test; restricted keys start with rk_. Only the public prefix is read. */
export function stripeKeyFacts(key: string | undefined): { present: boolean; mode: "live" | "test" | "unknown"; restricted: boolean } {
  const k = key?.trim() ?? "";
  if (!k) return { present: false, mode: "unknown", restricted: false };
  const mode = /^(sk|rk)_live_/.test(k) ? "live" : /^(sk|rk)_test_/.test(k) ? "test" : "unknown";
  return { present: true, mode, restricted: k.startsWith("rk_") };
}

export function buildIntegrationChecks(env: Env, last: IntegrationLast): IntegrationCheck[] {
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const production = env.NODE_ENV === "production";
  const stripe = stripeKeyFacts(env.STRIPE_SECRET_KEY);
  const stripeKind: StateKind = !stripe.present ? "crit" : stripe.mode === "unknown" ? "warn" : stripe.mode === "test" && production ? "warn" : "ok";
  const stripeDetail = !stripe.present
    ? "brak STRIPE_SECRET_KEY w panelu: „Zwrot…” i „Odśwież ze Stripe” nie zadziałają (webhooki obsługuje strona, nie panel)"
    : `klucz ${stripe.restricted ? "ograniczony (rk_)" : "pełny (sk_)"}, tryb ${stripe.mode === "live" ? "na żywo" : stripe.mode === "test" ? "TESTOWY" : "nieznany"}${stripe.mode === "test" && production ? " na produkcji" : ""}`;

  const webhookSecret = has(env, "STRIPE_WEBHOOK_SECRET");
  const mailKey = has(env, "SES_SMTP_USER") && has(env, "SES_SMTP_PASS");
  const mailSender = has(env, "EMAIL_FROM") ? "z EMAIL_FROM" : "domyślny (brak EMAIL_FROM)";
  const snsConfigured = getSnsConfig(env).topicArns.length > 0;
  const eventsNote = !snsConfigured
    ? "zdarzenia odbić/skarg: nie podłączone (brak SES_SNS_TOPIC_ARN, endpoint SNS odrzuca wszystko)"
    : last.emailEventAt
      ? "zdarzenia odbić/skarg: podłączone (SNS)"
      : "zdarzenia odbić/skarg: skonfigurowane (SES_SNS_TOPIC_ARN), ale nie dotarło jeszcze żadne zdarzenie";
  const r2 = ["CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS", "CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE"];
  const r2Missing = r2.filter((n) => !has(env, n));
  const access = has(env, "CF_ACCESS_TEAM_DOMAIN") && has(env, "CF_ACCESS_AUD");

  return [
    { id: "stripe", label: "Stripe (zwroty, spory)", kind: stripeKind, detail: stripeDetail, lastAt: iso(last.paymentAt), lastLabel: "ostatnia wpłata" },
    {
      id: "stripe-webhook",
      label: "Stripe: webhook (na stronie)",
      kind: last.stripeEventAt ? "ok" : "info",
      detail: webhookSecret ? "sekret podpisu ustawiony w panelu" : "podpis sprawdza strona (STRIPE_WEBHOOK_SECRET w app.env); panel go nie potrzebuje",
      lastAt: iso(last.stripeEventAt),
      lastLabel: "ostatnie zdarzenie",
    },
    {
      id: "ses",
      label: "Amazon SES (e-mail)",
      kind: mailKey ? (snsConfigured ? "ok" : "warn") : "warn",
      detail: mailKey
        ? `dane SMTP ustawione; nadawca ${mailSender}; rozsyłki wysyła kolejka na stronie; ${eventsNote}`
        : `brak SES_SMTP_USER / SES_SMTP_PASS w panelu: „Wyślij test do siebie” nie zadziała (rozsyłki wysyła strona); ${eventsNote}`,
      lastAt: iso(last.emailEventAt ?? last.broadcastAt),
      lastLabel: last.emailEventAt ? "ostatnie zdarzenie poczty" : "ostatnia rozsyłka",
    },
    { id: "r2", label: "Cloudflare R2 (pliki)", kind: r2Missing.length ? "warn" : "ok", detail: r2Missing.length ? `brakuje: ${r2Missing.join(", ")}` : "komplet zmiennych; test połączenia w System → Diagnostyka R2", lastAt: null },
    { id: "access", label: "Cloudflare Access (warstwa 1)", kind: access ? "ok" : production ? "crit" : "info", detail: access ? "zespół i znacznik aplikacji ustawione" : "brak CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD (produkcja odmawia każdego żądania)", lastAt: null },
    { id: "telemetry", label: "Telemetria (baza tylko do odczytu)", kind: has(env, "ADMIN_TELEMETRY_DATABASE_URL") ? "ok" : "info", detail: has(env, "ADMIN_TELEMETRY_DATABASE_URL") ? "adres bazy ustawiony" : "nie ustawiono ADMIN_TELEMETRY_DATABASE_URL: ekrany ruchu bez danych", lastAt: null },
    { id: "kv", label: "Redis (limity, pamięć podręczna)", kind: (has(env, "KV_REST_API_URL") || has(env, "UPSTASH_REDIS_REST_URL")) ? "ok" : "info", detail: (has(env, "KV_REST_API_URL") || has(env, "UPSTASH_REDIS_REST_URL")) ? "adres i token ustawione" : "sondowanie Redisa wyłączone w tym środowisku", lastAt: null },
    { id: "support", label: "PP Support", kind: "info", detail: "tylko odnośnik do skrzynki (support.pawelperfect.com); liczby wątków pojawią się z kolektorem", lastAt: null },
  ];
}

export async function getIntegrationStatus(ctx: Pick<AppContext, "prisma">, env: Env = process.env): Promise<IntegrationCheck[]> {
  const [stripeEvent, emailEvent, payment, broadcast] = await Promise.all([
    ctx.prisma.stripeEvent.findFirst({ where: { status: "PROCESSED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ctx.prisma.emailEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ctx.prisma.payment.findFirst({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ctx.prisma.broadcastEmail.findFirst({ where: { sentAt: { not: null } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
  ]);
  return buildIntegrationChecks(env, {
    stripeEventAt: stripeEvent?.createdAt ?? null,
    emailEventAt: emailEvent?.createdAt ?? null,
    paymentAt: payment?.updatedAt ?? null,
    broadcastAt: broadcast?.sentAt ?? null,
  });
}
