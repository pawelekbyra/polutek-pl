import Link from "next/link";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { VideoSearchService } from "@/lib/modules/video/application/video-search.service";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams;
  const rawQuery = searchParams.q ?? "";
  const normalizedQuery = VideoSearchService.normalizeQuery(rawQuery);
  const results = normalizedQuery
    ? await VideoSearchService.searchPublicVideos(rawQuery)
    : [];

  return (
    <div className="min-h-screen paper-surface font-sans ink-text">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 border-b paper-border pb-6">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] muted-text">
            Polutek.pl
          </p>
          <h1 className="text-3xl font-black tracking-tight ink-text sm:text-4xl">
            Wyniki wyszukiwania
          </h1>
          {normalizedQuery ? (
            <p className="mt-3 text-sm muted-text">
              Znaleziono {results.length}{" "}
              {results.length === 1 ? "materiał" : "materiałów"} dla „
              {rawQuery.trim()}”.
            </p>
          ) : (
            <p className="mt-3 text-sm muted-text">
              Wpisz frazę w wyszukiwarce, aby znaleźć publiczne materiały.
            </p>
          )}
        </div>

        {!normalizedQuery ? (
          <EmptySearchState message="Brak zapytania do wyszukania." />
        ) : results.length === 0 ? (
          <EmptySearchState message="Nie znaleziono publicznych materiałów dla tej frazy." />
        ) : (
          <div className="grid gap-4">
            {results.map((video) => (
              <Link
                key={video.id}
                href={`/?v=${video.slug || video.id}`}
                className="group flex gap-4 paper-radius-panel border paper-border paper-panel p-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition hover:border-[var(--najs-paper-line)] hover:bg-[rgba(241,234,217,0.86)] hover:shadow-[0_8px_22px_rgba(23,23,23,0.06)]"
              >
                <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl ink-button sm:h-32 sm:w-56">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={`Miniatura filmu: ${video.title}`}
                      fill
                      sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 100vw"
                      className="object-cover opacity-90 transition duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 py-1">
                  <h2 className="line-clamp-2 text-lg font-black tracking-tight ink-text group-hover:underline">
                    {video.title}
                  </h2>
                  {video.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 muted-text">
                      {video.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest muted-text">
                    {video.creator?.name ?? "Polutek"} ·{" "}
                    {video.views.toLocaleString("pl-PL")} wyświetleń
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function EmptySearchState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed paper-border paper-panel p-10 text-center shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <p className="mb-6 text-sm muted-text">{message}</p>
      <Link
        href="/"
        className="inline-flex rounded-full ink-button px-6 py-3 text-xs font-black uppercase tracking-widest text-[var(--najs-paper)] transition hover:bg-[rgba(23,23,23,0.9)]"
      >
        Wróć na kanał
      </Link>
    </div>
  );
}
