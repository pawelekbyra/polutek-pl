import type { Metadata } from "next";
import Link from "next/link";
import { MAX_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getAdminChannelSettings } from "@/lib/modules/channel";
import { getDefaultThumbnailState } from "@/lib/modules/admin-content";
import { getPaymentCurrencyLimits } from "@/lib/modules/payments";
import { fmtDateTime, fmtInt, fmtRelative, getAlertThresholds, getIntegrationStatus, THRESHOLD_FIELDS } from "@/lib/modules/admin-overview";
import { ChannelForm } from "@admin/components/settings/channel-form";
import { ChannelOwnerCard } from "@admin/components/settings/owner-card";
import { DefaultThumbnailCard } from "@admin/components/settings/thumbnail-card";
import { PaymentLimitsForm } from "@admin/components/settings/payment-limits-form";
import { ResyncButton } from "@admin/components/settings/resync-button";
import { ThresholdsForm } from "@admin/components/settings/thresholds-form";
import { SectionTabs, pickParam } from "@admin/components/section-tabs";
import { ThemeChoice } from "@admin/components/theme-choice";
import { Icon } from "@admin/components/icons";
import { Badge, Card, Check, Empty, PageHead } from "@admin/components/ui";
import { listAdminAccounts } from "@admin/lib/auth/accounts";
import { requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { panelContext } from "@admin/lib/actions/panel";

export const metadata: Metadata = { title: "Ustawienia" };

const TABS = ["kanal", "platnosci", "panel", "integracje", "konto"] as const;
const TAB_ITEMS = [
  ["kanal", "Kanał", "/ustawienia"],
  ["platnosci", "Płatności", "/ustawienia?tab=platnosci"],
  ["panel", "Panel i alerty", "/ustawienia?tab=panel"],
  ["integracje", "Integracje", "/ustawienia?tab=integracje"],
  ["konto", "Konto", "/ustawienia?tab=konto"],
] as const;

const METHODS: Record<string, string> = { PLN: "BLIK, karta, Przelewy24", EUR: "karta, portfele", USD: "karta, portfele", CHF: "karta, portfele", GBP: "karta, portfele" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = pickParam(await searchParams, "tab", TABS, "kanal");
  return (
    <>
      <PageHead title="Ustawienia" lede="Kanał, płatności, alerty, integracje i Twoje konto w panelu" />
      <SectionTabs label="Sekcje ustawień" items={TAB_ITEMS} current={tab} />
      {isDevFixturesEnabled() ? (
        tab === "panel" ? <PanelTab thresholds={null} /> : <Empty icon="info" title="Dane przykładowe">Ten ekran czyta bazę i konto panelu; uruchom panel z bazą, żeby go zobaczyć.</Empty>
      ) : tab === "kanal" ? (
        <ChannelTab />
      ) : tab === "platnosci" ? (
        <PaymentsTab />
      ) : tab === "panel" ? (
        <PanelTab thresholds={await loadThresholds()} />
      ) : tab === "integracje" ? (
        <IntegrationsTab />
      ) : (
        <AccountTab />
      )}
    </>
  );
}

async function ctxOf() {
  return panelContext(await requireAdmin("/ustawienia"));
}

async function loadThresholds() {
  return getAlertThresholds(await ctxOf());
}

async function ChannelTab() {
  const ctx = await ctxOf();
  const settings = await getAdminChannelSettings(ctx).catch(() => null);
  const thumb = await getDefaultThumbnailState(ctx).catch(() => null);
  if (!settings?.creator) {
    return (
      <Empty icon="warn" title="Nie udało się wczytać kanału">
        Sprawdź, czy kanał główny jest skonfigurowany (MAIN_CREATOR_SLUG) i zatwierdzony. Szczegóły w logu kontenera panelu.
      </Empty>
    );
  }
  const c = settings.creator;
  return (
    <div className="grid">
      <div className="span-8 stack">
        <Card id="h-ch" title="Kanał">
          <ChannelForm name={c.name} slug={c.slug} bio={c.bio ?? ""} />
        </Card>
        <DefaultThumbnailCard hasImage={!!thumb?.storageUrl} version={thumb?.updatedAt ?? "0"} creatorOverride={!!thumb?.creatorOverrideUrl} />
      </div>
      <div className="span-4 stack">
        <ChannelOwnerCard owner={c.user ? { id: c.user.id, email: c.user.email ?? "", name: c.user.name } : null} />
        <Card id="h-subs" title="Subskrybenci" foot={<ResyncButton />}>
          <div className="hero-num">{fmtInt(c.subscribersCount)}</div>
          <p className="muted">osób ze zgodą na powiadomienia o filmach (przeliczenie liczy wiersze Subscription)</p>
        </Card>
        <p className="foot-note">
          <Icon name="info" />
          Baner kanału nie istnieje: okładka została usunięta ze strony 2026-10-04, więc nie ma czego wgrywać. Licznik „wyświetlany” subskrybentów też nigdzie nie był używany.
        </p>
      </div>
    </div>
  );
}

async function PaymentsTab() {
  const limits = await getPaymentCurrencyLimits().catch(() => null);
  if (!limits) return <Empty icon="warn" title="Nie udało się wczytać minimalnych kwot">Szczegóły w logu kontenera panelu.</Empty>;
  const rows = SUPPORTED_CURRENCIES.map((c) => ({ currency: c, minAmount: String(limits[c].minAmount).replace(".", ","), maxAmount: MAX_PAYMENT_BY_CURRENCY[c], methods: METHODS[c] ?? "" }));
  return (
    <div className="grid">
      <div className="span-7">
        <Card id="h-pay" title="Minimalny napiwek" sub="Dolna granica kwoty w bramce napiwkowej, osobno dla każdej waluty." flush>
          <PaymentLimitsForm rows={rows} />
        </Card>
      </div>
      <div className="span-5">
        <Card id="h-stripe" title="Stripe" foot={<Link href="/ustawienia?tab=integracje">Stan integracji</Link>}>
          <p className="muted">Tryb klucza, webhook i ostatnie wpłaty są w zakładce Integracje; zdarzenia i zwroty w <Link href="/przychody?tab=stripe">Przychodach</Link>.</p>
        </Card>
      </div>
    </div>
  );
}

function PanelTab({ thresholds }: { thresholds: Awaited<ReturnType<typeof getAlertThresholds>> | null }) {
  return (
    <div className="grid">
      <div className="span-6 stack">
        <Card id="h-look" title="Wygląd panelu">
          <ThemeChoice />
        </Card>
      </div>
      <div className="span-6">
        {thresholds ? (
          <Card id="h-alerts" title="Progi alertów" sub="Kiedy dysk, RAM i swap zmieniają kolor na żółty i czerwony.">
            <ThresholdsForm
              custom={thresholds.custom}
              rows={THRESHOLD_FIELDS.map((f) => ({ key: f.key, label: f.label, hint: f.hint, warnAt: thresholds.limits[f.key].warnAt, critAt: thresholds.limits[f.key].critAt }))}
            />
            <p className="foot-note">
              <Icon name="info" />
              Godziny ciszy i kanały alertów (e-mail, push) nie są tu ustawiane: panel jeszcze niczego nie wysyła z alertów, więc nie byłoby to do czego podłączyć.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

async function IntegrationsTab() {
  const ctx = await ctxOf();
  const checks = await getIntegrationStatus(ctx).catch(() => null);
  const now = new Date();
  if (!checks) return <Empty icon="warn" title="Nie udało się odczytać stanu integracji" />;
  return (
    <Card id="h-int" title="Integracje" sub="Tylko stan i ostatnie ślady w naszej bazie. Wartości sekretów nigdy nie są pokazywane, a panel niczego nie wywołuje w zewnętrznych usługach przy wyświetlaniu.">
      <div className="checks">
        {checks.map((c) => (
          <Check key={c.id} kind={c.kind} title={c.label} sub={`${c.detail}${c.lastAt ? ` · ${c.lastLabel ?? "ostatnio"}: ${fmtRelative(c.lastAt, now)} (${fmtDateTime(c.lastAt, now)})` : ""}`} />
        ))}
      </div>
    </Card>
  );
}

async function AccountTab() {
  const viewer = await requireAdmin("/ustawienia?tab=konto");
  const accounts = await listAdminAccounts().catch(() => []);
  const me = accounts.find((a) => a.id === viewer.userId);
  return (
    <div className="grid">
      <div className="span-7">
        <Card id="h-me" title="Twoje konto w panelu" sub="Osobne od konta na stronie. Logowanie tylko kluczem dostępu; TOTP służy do potwierdzania ważnych operacji.">
          {me ? (
            <dl className="kv kv-wide">
              <dt>E-mail</dt>
              <dd>{me.email}</dd>
              <dt>Nazwa</dt>
              <dd>{me.name}</dd>
              <dt>Rola</dt>
              <dd>{me.role === "OWNER" ? "właściciel (cały panel)" : "tłumacz (tylko tłumaczenia)"}</dd>
              <dt>Klucze dostępu</dt>
              <dd>
                {me.passkeys.length ? me.passkeys.map((p) => <Badge key={p.id} kind="outline" icon="passkey">{p.name || (p.deviceType === "multiDevice" ? "klucz wielourządzeniowy" : "klucz sprzętowy")}</Badge>) : "brak"}
              </dd>
              <dt>TOTP</dt>
              <dd>{me.totp ? <Badge kind="ok">włączony</Badge> : <Badge kind="crit">wyłączony</Badge>}</dd>
              <dt>Ostatnie logowanie</dt>
              <dd>{me.lastSignInAt ? fmtDateTime(me.lastSignInAt, new Date()) : "brak w dzienniku"}</dd>
            </dl>
          ) : (
            <p className="muted">Podgląd lokalny albo konto nieznalezione.</p>
          )}
        </Card>
      </div>
      <div className="span-5 stack">
        <Card id="h-recovery" title="Utrata klucza albo telefonu">
          <p>Panel nie ma resetu e-mailem ani hasła. Dostęp odzyskuje się z serwera (SSH): <span className="mono">admin-enroll --reset</span> wydaje nowy, 15-minutowy link rejestracji.</p>
          <p className="muted">Sesje i logowania: <Link href="/bezpieczenstwo">Bezpieczeństwo</Link>.</p>
        </Card>
      </div>
    </div>
  );
}
