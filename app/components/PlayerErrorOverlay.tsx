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

  const messages = {
    pl: {
      title: "Nie udało się odtworzyć filmu.",
      description: "Materiał jest chwilowo niedostępny albo źródło wideo nie odpowiada.",
      retry: "Spróbuj ponownie"
    },
    en: {
      title: "Could not play this video.",
      description: "This video is temporarily unavailable or the video source is not responding.",
      retry: "Try again"
    }
  };

  const t = language === 'pl' ? messages.pl : messages.en;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-white p-6 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>

      <h3 className="text-lg font-black uppercase tracking-tight mb-2">
        {t.title}
      </h3>

      <p className="text-sm text-neutral-400 max-w-xs mb-8 leading-relaxed">
        {t.description}
      </p>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-full px-8 h-12 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95"
        >
          <RefreshCcw size={14} className="mr-2" />
          {t.retry}
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
