import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@admin/components/ui";
import { loadModerationCounts } from "@admin/lib/community";
import { CommentsTab } from "./_tabs/comments-tab";
import { ModerationTab } from "./_tabs/moderation-tab";
import { UsersTab } from "./_tabs/users-tab";

export const metadata: Metadata = { title: "Społeczność" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CommunityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = one(sp.tab);
  // "zgloszenia" was the tab name of the first draft; links to it keep working.
  const tab = raw === "komentarze" || raw === "uzytkownicy" ? raw : "moderacja";
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const q = one(sp.q).slice(0, 120);
  const counts = await loadModerationCounts();
  const tabs: [string, string, string, number][] = [
    ["moderacja", "Moderacja", "/spolecznosc", counts.comments],
    ["komentarze", "Komentarze", "/spolecznosc?tab=komentarze", 0],
    ["uzytkownicy", "Użytkownicy", "/spolecznosc?tab=uzytkownicy", 0],
  ];
  return (
    <>
      <PageHead
        title="Społeczność"
        lede="Moderacja komentarzy, komentarze i osoby. Zmiana roli, usunięcie konta, usunięcie komentarza i eksport wymagają potwierdzenia tożsamości."
        actions={<Link className="btn" href="/spolecznosc?tab=komentarze&status=Q">Pytania bez odpowiedzi</Link>}
      />
      <nav className="tabs" aria-label="Sekcje społeczności">
        {tabs.map(([id, label, href, n]) => (
          <Link key={id} href={href} aria-current={tab === id ? "page" : undefined}>
            {label}
            {n ? <span className="badge warn">{n}<span className="sr-only"> do decyzji</span></span> : null}
          </Link>
        ))}
      </nav>
      {tab === "moderacja" ? <ModerationTab history={one(sp.stan) === "rozstrzygniete"} page={page} /> : null}
      {tab === "komentarze" ? <CommentsTab q={q} status={one(sp.status)} vid={one(sp.vid)} autor={one(sp.autor).slice(0, 64)} page={page} /> : null}
      {tab === "uzytkownicy" ? <UsersTab q={q} seg={one(sp.seg)} sort={one(sp.sort)} page={page} deleted={one(sp.usunieto) !== ""} /> : null}
    </>
  );
}
