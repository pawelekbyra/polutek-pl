import type { Metadata } from "next";
import { StepUpCard } from "@admin/components/auth/step-up-card";
import { Card, PageHead } from "@admin/components/ui";
import { requireAdmin } from "@admin/lib/auth/guard";
import { safeNextPath } from "@admin/lib/auth/session-rules";

export const metadata: Metadata = { title: "Potwierdź tożsamość" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StepUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const viewer = await requireAdmin(`/potwierdz?next=${encodeURIComponent(next)}`);
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
