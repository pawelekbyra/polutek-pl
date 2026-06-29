import { Metadata } from "next";
import { loadHomeContent } from "@/lib/services/home-content.loader";
import { PublicVideoDTO } from "@/app/types/video";
import RoughHome from "./RoughHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 1 — Rough UI · Polutek",
  description: "Bliźniacza strona główna Polutek w stylu odręcznym (RoughJS + Rough Notation + papierowe tło).",
};

export default async function Eksperyment1Page(props: { searchParams: Promise<{ v?: string }> }) {
  const searchParams = await props.searchParams;
  const content = await loadHomeContent().catch(() => null);

  const { mainVideo, allVideos } =
    content?.status === "ready"
      ? content
      : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  if (!mainVideo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Brak danych wideo — sprawdź środowisko.
      </div>
    );
  }

  return (
    <RoughHome
      mainVideo={mainVideo}
      allVideos={allVideos}
      currentVideoId={searchParams.v}
    />
  );
}
