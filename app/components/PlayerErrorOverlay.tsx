"use client";

import { useLanguage } from './LanguageContext';
import { Button } from '@/components/ui/button';
import { CircleAlert, RefreshCw } from 'lucide-react';

interface PlayerErrorOverlayProps {
  errorCode?: string;
  onRetry?: () => void;
  isAdmin?: boolean;
  showTechnicalDetails?: boolean;
}

export function PlayerErrorOverlay({
  errorCode,
  onRetry,
  isAdmin = false,
  showTechnicalDetails = false
}: PlayerErrorOverlayProps) {
  const { language } = useLanguage();

  const getErrorContent = (code?: string, lang: string = 'pl') => {
    const isPl = lang === 'pl';

    switch (code) {
      case 'NO_PLAYBACK_PLAN':
        return {
          title: isPl ? "Nie udało się przygotować odtwarzania." : "Could not prepare playback.",
          description: isPl ? "Spróbuj ponownie za chwilę." : "Please try again in a moment."
        };
      case 'NO_PLAYBACK_URL':
        return {
          title: isPl ? "Film nie ma poprawnego źródła odtwarzania." : "This video has no valid playback source.",
          description: isPl ? "Materiał nie może zostać teraz uruchomiony." : "The video cannot be started right now."
        };
      case 'MEDIA_LOAD_FAILED':
        return {
          title: isPl ? "Nie udało się załadować materiału wideo." : "Could not load the video.",
          description: isPl ? "Źródło może być chwilowo niedostępne." : "The video source may be temporarily unavailable."
        };
      case 'SOURCE_ERROR':
        return {
          title: isPl ? "Źródło wideo nie odpowiada." : "The video source is not responding.",
          description: isPl ? "Spróbuj ponownie albo wybierz inny film." : "Try again or choose another video."
        };
      case 'UNSUPPORTED_SOURCE':
        return {
          title: isPl ? "Ten format wideo nie jest obsługiwany." : "This video format is not supported.",
          description: isPl ? "Spróbuj odtworzyć inny materiał." : "Try playing another video."
        };
      case 'ACCESS_ERROR':
        return {
          title: isPl ? "Błąd dostępu do materiału." : "Access error.",
          description: isPl ? "Sprawdź swoje uprawnienia i spróbuj ponownie." : "Please check your permissions and try again."
        };
      case 'NETWORK_ERROR':
        return {
          title: isPl ? "Błąd połączenia sieciowego." : "Network error.",
          description: isPl ? "Sprawdź swoje połączenie z internetem." : "Please check your internet connection."
        };
      default:
        return {
          title: isPl ? "Nie udało się odtworzyć filmu." : "Could not play this video.",
          description: isPl ? "Materiał jest chwilowo niedostępny albo źródło wideo nie odpowiada." : "This video is temporarily unavailable or the video source is not responding."
        };
    }
  };

  const content = getErrorContent(errorCode, language);
  const retryLabel = language === 'pl' ? "Spróbuj ponownie" : "Try again";

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--chan-nav,#f7f9fc)] p-6 text-center text-[var(--chan-ink,#111827)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 [container-type:inline-size]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] border border-red-500/20 bg-[color-mix(in_srgb,var(--chan-card)_92%,white)] text-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_16px_32px_-12px_rgba(220,38,38,0.3)]">
        <CircleAlert className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3 className="mb-2 max-w-md font-brand text-[min(1.2rem,6cqi)] font-bold tracking-[-0.01em]">
        {content.title}
      </h3>

      <p className="mb-7 max-w-xs text-[min(0.875rem,4cqi)] leading-relaxed text-[var(--chan-muted,#64748b)]">
        {content.description}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          className="h-[min(2.75rem,12cqi)] rounded-xl bg-[var(--chan-blue)] px-6 font-brand text-[min(13px,3.2cqi)] font-bold text-white shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--chan-blue)_50%,transparent)] transition-all hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--chan-blue)_88%,black)] active:translate-y-0 active:scale-[0.97]"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </Button>
      )}

      {(isAdmin || showTechnicalDetails) && errorCode && (
        <div className="absolute bottom-4 right-4 rounded-md border border-black/10 bg-white/70 px-2 py-1 font-mono text-[9px] uppercase tracking-tighter text-black/35">
          Dev Error: {errorCode}
        </div>
      )}
    </div>
  );
}
