import React from 'react';
import { Metadata } from 'next';
import { APP_NAME } from '@/lib/constants';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import MainRoughHome from './components/MainRoughHome';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const content = await loadHomeContent();
  if (content.status !== 'ready') return { title: APP_NAME };

  const { creator, mainVideo } = content;
  return {
    title: APP_NAME,
    description: creator?.bio ?? `${APP_NAME} — kanał wideo`,
    openGraph: {
      title: mainVideo?.title ?? APP_NAME,
      images: mainVideo?.thumbnailUrl ? [{ url: mainVideo.thumbnailUrl }] : [],
      type: 'video.other',
    },
  };
}

export default async function Home(props: { searchParams: Promise<{ v?: string, q?: string }> }) {
  const searchParams = await props.searchParams;
  const content = await loadHomeContent();

  if (content.status === 'error' || content.status === 'empty') {
    const isError = content.status === 'error';
    return (
      <main className="min-h-screen bg-[#f8f3e7] px-6 py-20 text-center text-neutral-950">
        <div className="mx-auto max-w-3xl rounded-[28px] border-2 border-neutral-900/70 bg-[#f8f3e7]/80 p-10 shadow-none">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-blue-600">POLUTEK.PL</p>
          <h1 className="text-3xl font-black tracking-[-0.04em]">
            {isError ? 'Błąd wczytywania' : 'Brak materiałów'}
          </h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-neutral-700">
            {isError
              ? content.publicMessage
              : 'Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <MainRoughHome
      mainVideo={content.mainVideo}
      allVideos={content.allVideos}
      currentVideoId={searchParams.v}
    />
  );
}
