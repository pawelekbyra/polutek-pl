import Link from "next/link";
import { ModerationQueue } from "@admin/components/community/moderation-queue";
import { Pager } from "@admin/components/community/pager";
import { Badge, Empty } from "@admin/components/ui";
import { fmtDateTime } from "@/lib/modules/admin-overview";
import { loadQueue, loadResolved } from "@admin/lib/community";
import { REPORT_REASON, withParams } from "@admin/lib/community-format";

/** Queue of decisions (default) and, under `?stan=rozstrzygniete`, the history of closed reports. */
export async function ModerationTab({ history, page }: { history: boolean; page: number }) {
  const href = (p: number) => withParams("/spolecznosc", { tab: "moderacja", stan: history ? "rozstrzygniete" : undefined, page: p > 1 ? p : undefined });
  return (
    <>
      <nav className="tile-link-row" aria-label="Widok moderacji">
        <Link className={`btn btn-sm${!history ? " btn-primary" : ""}`} href="/spolecznosc" aria-current={!history ? "page" : undefined}>Do decyzji</Link>
        <Link className={`btn btn-sm${history ? " btn-primary" : ""}`} href="/spolecznosc?tab=moderacja&stan=rozstrzygniete" aria-current={history ? "page" : undefined}>Rozstrzygnięte zgłoszenia</Link>
      </nav>
      {history ? <History page={page} href={href} /> : <Queue page={page} href={href} />}
    </>
  );
}

async function Queue({ page, href }: { page: number; href: (p: number) => string }) {
  const q = await loadQueue(page);
  return (
    <>
      <ModerationQueue items={q.items} />
      <div className="card card-flush mt-3"><Pager page={q.page} pageSize={q.pageSize} total={q.total} totalPages={q.totalPages} href={href} noun="komentarzy" /></div>
    </>
  );
}

async function History({ page, href }: { page: number; href: (p: number) => string }) {
  const h = await loadResolved(page);
  const now = new Date();
  return (
    <section className="card card-flush" aria-label="Rozstrzygnięte zgłoszenia">
      {h.items.length === 0 ? (
        <Empty icon="flag" title="Brak rozstrzygniętych zgłoszeń" />
      ) : (
        h.items.map((r) => (
          <article className="mod-item" key={r.id}>
            <div>
              <blockquote>{r.comment.text ?? <span className="muted">(treść niedostępna)</span>}</blockquote>
              <div className="mod-meta">
                <Badge kind={r.status === "ACTION_TAKEN" ? "warn" : ""} icon="flag">{r.status === "ACTION_TAKEN" ? "uznane" : "oddalone"}: {REPORT_REASON[r.reason] ?? r.reason}</Badge>
                <span>autor: {r.comment.author}</span>
                <span>zgłosił(a): {r.reporter}</span>
                {r.comment.videoSlug ? <Link href={`/tresci/${r.comment.videoSlug}`}>„{r.comment.videoTitle}”</Link> : null}
                {r.resolvedAt ? <span>{fmtDateTime(r.resolvedAt, now)}</span> : null}
              </div>
            </div>
          </article>
        ))
      )}
      <Pager page={h.page} pageSize={h.pageSize} total={h.total} totalPages={h.totalPages} href={href} noun="zgłoszeń" />
    </section>
  );
}
