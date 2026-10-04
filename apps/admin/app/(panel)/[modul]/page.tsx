import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@admin/components/icons";
import { ThemeChoice } from "@admin/components/theme-choice";
import { Badge, Card, ExternalLink, PageHead } from "@admin/components/ui";
import { UPCOMING_MODULES } from "@admin/lib/upcoming-modules";

type Props = { params: Promise<{ modul: string }> };

const publicBase = () => (process.env.NEXT_PUBLIC_APP_URL || "https://www.pawelperfect.com").replace(/\/+$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = UPCOMING_MODULES[(await params).modul];
  return { title: m?.title ?? "Nie znaleziono" };
}

/** A module that is not built yet: what it will do, when, and where to do it today. No mock data. */
export default async function UpcomingModulePage({ params }: Props) {
  const m = UPCOMING_MODULES[(await params).modul];
  if (!m) notFound();
  return (
    <>
      <PageHead title={m.title} lede={<Badge kind="info" icon="clock">W budowie: faza {m.phase}</Badge>} />
      <div className="soon">
        {m.id === "ustawienia" ? (
          <Card id="h-look" title="Wygląd panelu">
            <ThemeChoice />
          </Card>
        ) : null}
        <Card id="h-scope" title="Co tu będzie">
          <p>{m.summary}</p>
          <ul>
            {m.scope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        {m.today?.length ? (
          <Card id="h-today" title="Do tego czasu" sub="Stary panel na www działa bez zmian do fazy 5; każda sekcja przechodzi tutaj, gdy jest gotowa.">
            <div className="pill-row">
              {m.today.map((t) => (
                <ExternalLink key={t.path} className="btn" href={`${publicBase()}${t.path}`}>
                  {t.label}
                </ExternalLink>
              ))}
            </div>
          </Card>
        ) : null}
        <p className="foot-note">
          <Icon name="info" />
          Plan faz i decyzje: docs/architecture/admin-panel.md, sekcje 3 i 4.
        </p>
      </div>
    </>
  );
}
