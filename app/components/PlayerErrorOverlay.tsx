"use client";

import { useLanguage } from './LanguageContext';
import { Button } from '@/components/ui/button';
import { AlertIcon, RefreshIcon } from './icons/MarkerUiIcons';

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
  const { tx } = useLanguage();

  const getErrorContent = (code?: string) => {
    switch (code) {
      case 'NO_PLAYBACK_PLAN':
        return {
          title: tx("Nie udało się przygotować odtwarzania.", "Could not prepare playback."),
          description: tx("Spróbuj ponownie za chwilę.", "Please try again in a moment.")
        };
      case 'NO_PLAYBACK_URL':
        return {
          title: tx("Film nie ma poprawnego źródła odtwarzania.", "This video has no valid playback source."),
          description: tx("Materiał nie może zostać teraz uruchomiony.", "The video cannot be started right now.")
        };
      case 'MEDIA_LOAD_FAILED':
        return {
          title: tx("Nie udało się załadować materiału wideo.", "Could not load the video."),
          description: tx("Źródło może być chwilowo niedostępne.", "The video source may be temporarily unavailable.")
        };
      case 'SOURCE_ERROR':
        return {
          title: tx("Źródło wideo nie odpowiada.", "The video source is not responding."),
          description: tx("Spróbuj ponownie albo wybierz inny film.", "Try again or choose another video.")
        };
      case 'UNSUPPORTED_SOURCE':
        return {
          title: tx("Ten format wideo nie jest obsługiwany.", "This video format is not supported."),
          description: tx("Spróbuj odtworzyć inny materiał.", "Try playing another video.")
        };
      case 'ACCESS_ERROR':
        return {
          title: tx("Błąd dostępu do materiału.", "Access error."),
          description: tx("Sprawdź swoje uprawnienia i spróbuj ponownie.", "Please check your permissions and try again.")
        };
      case 'NETWORK_ERROR':
        return {
          title: tx("Błąd połączenia sieciowego.", "Network error."),
          description: tx("Sprawdź swoje połączenie z internetem.", "Please check your internet connection.")
        };
      default:
        return {
          title: tx("Nie udało się odtworzyć filmu.", "Could not play this video."),
          description: tx("Materiał jest chwilowo niedostępny albo źródło wideo nie odpowiada.", "This video is temporarily unavailable or the video source is not responding.")
        };
    }
  };

  const content = getErrorContent(errorCode);
  const retryLabel = tx("Spróbuj ponownie", "Try again");

  return (
    <div role="alert" className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--chan-nav,#f7f9fc)] p-6 text-center text-[var(--chan-ink,#111827)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 [container-type:inline-size]">
      <AlertIcon size={56} className="mb-4 text-red-500" />

      <h3 className="mb-2 max-w-md font-brand text-[min(1.2rem,6cqi)] font-bold tracking-[-0.01em]">
        {content.title}
      </h3>

      <p className="mb-7 max-w-xs text-[min(0.875rem,4cqi)] leading-relaxed text-[var(--chan-muted,#64748b)]">
        {content.description}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          className="h-[min(2.75rem,12cqi)] rounded-xl bg-[var(--chan-blue)] px-6 font-brand text-[min(13px,3.2cqi)] font-bold text-white shadow-[0_8px_20px_-6px_var(--cm-blue-50)] transition-all hover:-translate-y-px hover:bg-[var(--cm-blue-88-black)] active:translate-y-0 active:scale-[0.97]"
        >
          <RefreshIcon size={18} className="mr-2" />
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
