"use client";

import React from 'react';
import { AlertCircle, RefreshCcw } from './icons';
import { useLanguage } from './LanguageContext';
import { Button } from '@/components/ui/button';

interface PlayerErrorOverlayProps {
  errorCode?: string;
  onRetry?: () => void;
  isAdmin?: boolean;
  showTechnicalDetails?: boolean;
}

export const PlayerErrorOverlay: React.FC<PlayerErrorOverlayProps> = ({
  errorCode,
  onRetry,
  isAdmin = false,
  showTechnicalDetails = false
}) => {
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
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 text-center animate-in fade-in duration-500 [container-type:inline-size]">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>

      <h3 className="text-[min(1.2rem,6cqi)] font-black uppercase tracking-tight mb-2 max-w-md">
        {content.title}
      </h3>

      <p className="text-[min(0.875rem,4cqi)] text-neutral-400 max-w-xs mb-8 leading-relaxed">
        {content.description}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-full px-8 h-[min(3rem,12cqi)] font-black uppercase tracking-widest text-[min(11px,3cqi)] transition-all active:scale-95"
        >
          <RefreshCcw size={14} className="mr-2" />
          {retryLabel}
        </Button>
      )}

      {(isAdmin || showTechnicalDetails) && errorCode && (
        <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/40 rounded border border-white/5 text-[9px] font-mono text-white/30 uppercase tracking-tighter">
          Dev Error: {errorCode}
        </div>
      )}
    </div>
  );
};
