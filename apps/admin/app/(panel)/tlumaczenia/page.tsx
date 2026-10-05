import type { Metadata } from "next";
import Link from "next/link";
import { TRANSLATION_LANGUAGES, listTranslationQueue } from "@/lib/modules/translations";
import { Icon } from "@admin/components/icons";
import { Badge, Empty, PageHead } from "@admin/components/ui";
import { panelContext } from "@admin/lib/actions/panel";
import { requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";

export const metadata: Metadata = { title: "Do przetłumaczenia" };

const STATE: Record<string, [string, "ok" | "warn" | "crit" | ""]> = { AI_DRAFT: ["szkic automatyczny", "warn"], APPROVED: ["zatwierdzone", "ok"], EDITED: ["napisane", "ok"] };

/** Home of a translator (and a shortcut for the owner): films with a missing or machine-drafted language first. */
export default async function TranslationQueuePage() {
  const viewer = await requireAdmin("/tlumaczenia", { roles: ["OWNER", "TRANSLATOR"] });
  const languages = viewer.role === "OWNER" ? TRANSLATION_LANGUAGES.map((l) => l.code) : viewer.languages;
  const items = isDevFixturesEnabled() ? [] : await listTranslationQueue(languages, await panelContext(viewer));
  return (
    <>
      <PageHead title="Do przetłumaczenia" lede={languages.length ? `Twoje języki: ${languages.map((c) => TRANSLATION_LANGUAGES.find((l) => l.code === c)?.namePl ?? c).join(", ")}` : "Nie masz jeszcze przyznanych języków. Poproś właściciela."} />
      {items.length === 0 ? (
        <Empty icon="film" title="Nie ma filmów do tłumaczenia">{languages.length ? "Gdy pojawi się film, będzie tutaj." : "Brak przyznanych języków."}</Empty>
      ) : (
        <section className="card card-flush" aria-label="Filmy">
          <ul className="list list-pad">
            {items.map((i) => (
              <li key={i.slug}>
                <div className="li-main">
                  <Link className="li-title" href={`/tlumaczenia/${i.slug}`}>{i.title}</Link>
                  <span className="li-sub">{i.languages.map((l) => `${l.code.toUpperCase()}: ${l.status ? STATE[l.status][0] : "brak"}`).join(" · ")}</span>
                </div>
                {i.languages.some((l) => l.status === null || l.status === "AI_DRAFT") ? <Badge kind="warn" icon="note">do zrobienia</Badge> : <Badge kind="ok">gotowe</Badge>}
                <Link className="btn btn-sm" href={`/tlumaczenia/${i.slug}`}>Otwórz <Icon name="right" /></Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
