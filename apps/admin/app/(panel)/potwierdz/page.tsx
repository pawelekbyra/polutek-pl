import type { Metadata } from "next";
import { StepUpCard } from "@admin/components/auth/step-up-card";
import { Card, PageHead } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";
import { safeNextPath } from "@admin/lib/auth/session-rules";
import { ACCESS_LOGOUT_PATH, ADMIN_ACCESS_MAX_AGE_SECONDS } from "@admin/lib/config";

export const metadata: Metadata = { title: "Potwierdź tożsamość" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StepUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const viewer = await requireAdmin(`/potwierdz?next=${encodeURIComponent(next)}`);
  if (viewer.authMode === "access") {
    // Access mode: no passkey or TOTP. The panel asks for a fresh Cloudflare login only when the token is older than 12 h.
    const hours = ADMIN_ACCESS_MAX_AGE_SECONDS / 3600;
    return (
      <>
        <PageHead title="Ponowne logowanie" lede={`Operacje bez cofnięcia (zwrot, rozsyłka, eksport danych osobowych, usunięcie) wymagają logowania z ostatnich ${hours} godzin.`} />
        <div className="soon">
          <Card id="h-stepup" title={viewer.stepUpSecondsLeft > 0 ? "Logowanie jest aktualne" : "Zaloguj się ponownie"} sub="Panel nie używa kluczy dostępu ani TOTP: logowanie to kod z e-maila od Cloudflare Access.">
            {viewer.stepUpSecondsLeft > 0 ? (
              <p>Jesteś zalogowany jako <strong>{viewer.email}</strong>; logowanie jest ważne jeszcze {Math.ceil(viewer.stepUpSecondsLeft / 60)} min. <a href={next}>Wróć do poprzedniego ekranu</a>.</p>
            ) : (
              <p>Wyloguj się z Cloudflare i wejdź na panel jeszcze raz: <a className="btn btn-primary" href={ACCESS_LOGOUT_PATH}>Zaloguj ponownie</a></p>
            )}
          </Card>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Potwierdź tożsamość" lede="Przed operacją, której nie da się cofnąć (zwrot, rozsyłka, eksport danych osobowych), panel prosi o ponowne potwierdzenie. Ważne 5 minut." />
      <div className="soon">
        <Card id="h-stepup" title="Jak potwierdzić" sub="Każda próba trafia do dziennika logowań panelu.">
          <StepUpCard next={next} secondsLeft={viewer.stepUpSecondsLeft} />
        </Card>
      </div>
    </>
  );
}
