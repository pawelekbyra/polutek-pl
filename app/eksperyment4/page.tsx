import React from "react";
import { Metadata } from "next";
import { loadHomeContent } from "@/lib/services/home-content.loader";
import RoughHome from "../eksperyment1/RoughHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 4 · Polutek",
  description: "Roughowa atrapa strony głównej Polutek z ręcznie rysowanymi ikonami i liniami.",
};

export default async function Eksperyment4Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const content = await loadHomeContent();

  if (content.status === "error" || content.status === "empty") {
    return (
      <main className="min-h-screen bg-[#f8f3e7] px-6 py-20 text-center text-neutral-950">
        <div className="mx-auto max-w-3xl rounded-[28px] border-2 border-neutral-900/70 bg-[#f8f3e7]/80 p-10 shadow-none">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-blue-600">Eksperyment 4</p>
          <h1 className="text-3xl font-black tracking-[-0.04em]">Brak materiałów</h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-neutral-700">
            Nie znaleziono filmów do wypełnienia atrapy.
          </p>
        </div>
      </main>
    );
  }

  return (
    <RoughHome
      mainVideo={content.mainVideo}
      allVideos={content.allVideos}
      currentVideoId={searchParams.v}
      basePath="/eksperyment4"
      experimentLabel="eksperyment4 — roughowa atrapa ikon, linii i układu"
    />
  );
}
