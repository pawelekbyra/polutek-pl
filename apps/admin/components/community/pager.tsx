import Link from "next/link";
import { Icon } from "@admin/components/icons";

/** "1–25 z 74" with previous/next as plain links (state lives in the URL). */
export function Pager({ page, pageSize, total, totalPages, href, noun }: { page: number; pageSize: number; total: number; totalPages: number; href: (p: number) => string; noun: string }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pager">
      <span>{from}–{to} z {total} {noun}</span>
      {totalPages > 1 ? (
        <nav aria-label="Strony listy">
          {page > 1 ? <Link className="btn btn-sm" href={href(page - 1)} aria-label="Poprzednia strona"><Icon name="left" /></Link> : null}
          <span className="muted">Strona {page} z {totalPages}</span>
          {page < totalPages ? <Link className="btn btn-sm" href={href(page + 1)} aria-label="Następna strona"><Icon name="right" /></Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
