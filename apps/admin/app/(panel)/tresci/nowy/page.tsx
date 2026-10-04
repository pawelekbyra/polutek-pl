import type { Metadata } from "next";
import Link from "next/link";
import { NewFilmForm } from "@admin/components/content/new-film-form";
import { Icon } from "@admin/components/icons";
import { PageHead } from "@admin/components/ui";

export const metadata: Metadata = { title: "Nowy film · Treści" };

export default function NewFilmPage() {
  return (
    <>
      <PageHead
        title="Nowy film"
        lede="Szkic powstaje od razu; kodowanie rusza po wgraniu oryginału, publikacja dopiero po liście kontrolnej."
        crumbs={
          <>
            <Link href="/tresci">Treści</Link>
            <Icon name="right" />
            <span>Nowy film</span>
          </>
        }
        actions={
          <Link className="btn" href="/tresci">
            Anuluj
          </Link>
        }
      />
      <ol className="modal-steps mb-3 steps-plain" aria-label="Kroki">
        <li aria-current="step">1. Metadane</li>
        <li>· 2. Oryginał</li>
        <li>· 3. Kodowanie</li>
        <li>· 4. Publikacja</li>
      </ol>
      <div className="grid">
        <div className="span-8">
          <NewFilmForm />
        </div>
        <div className="span-4 stack">
          <section className="card" aria-labelledby="h-next">
            <div className="card-head">
              <h2 id="h-next">Co dalej</h2>
            </div>
            <ul className="checklist">
              <li className="warn">
                <Icon name="warn" />
                <span>Oryginał wgrany i zakodowany (krok 2 i 3)</span>
              </li>
              <li className="warn">
                <Icon name="warn" />
                <span>Miniatura (inaczej domyślna kanału)</span>
              </li>
              <li className="warn">
                <Icon name="warn" />
                <span>Napisy PL (zalecane)</span>
              </li>
              <li className="warn">
                <Icon name="warn" />
                <span>Publikacja albo premiera o godzinie</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
