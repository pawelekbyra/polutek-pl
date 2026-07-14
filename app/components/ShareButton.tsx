"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Facebook, Mail, MessageCircle, Send } from 'lucide-react';
import { useShare } from '@/app/hooks/useShare';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  url?: string;
  title: string;
  text?: string;
  className?: string;
  /** Stretch to fill remaining row width on mobile, matching desktop's fixed width from `lg` up. */
  fill?: boolean;
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cn("h-4 w-4 fill-current", className)}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function ShareButton({
  url: propUrl,
  title,
  text,
  className,
  fill = false,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isMobile, share, copied, copyToClipboard } = useShare();
  const popoverRef = useRef<HTMLDivElement>(null);
  const url = propUrl || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      await share({ title, text, url });
    } else {
      setIsOpen(!isOpen);
    }
  };

  const openWindow = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", fill ? "flex-1 lg:flex-none" : "inline-block")}>
      <button
        onClick={handleShareClick}
        className={cn(
          "relative flex items-center justify-center gap-1.5 h-10 px-3 rounded-[8px] active:scale-95 text-[var(--chan-ink)] font-bold text-sm font-sans transition-colors duration-160 bg-[var(--chan-surface)] hover:bg-[var(--chan-line)]",
          fill && "w-full",
          className
        )}
      >
        <Send className="h-5 w-5 shrink-0" strokeWidth={1.8} color="var(--chan-ink)" />
        <span className="leading-none">Szeruj</span>
      </button>

      {isOpen && !isMobile && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute bottom-[calc(100%+8px)] right-0 min-w-[240px] z-[1100]",
            "rounded-[8px] border border-[var(--chan-line)] bg-white p-1.5 shadow-[var(--chan-shadow-card)]",
            "animate-in fade-in-0 zoom-in-95 duration-150 slide-in-from-bottom-2"
          )}
        >
          <div
            onClick={() => copyToClipboard(url)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm cursor-pointer transition-colors duration-100 font-bold uppercase tracking-wider text-[#2563eb]",
              copied ? "bg-[#EFF3FE]" : "hover:bg-[var(--chan-surface)]"
            )}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Skopiowano!" : "Kopiuj link"}</span>
          </div>

          <div className="my-1 h-px bg-[var(--chan-line)]" />

          <div
            onClick={() => openWindow(`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm hover:bg-[var(--chan-surface)] cursor-pointer transition-colors duration-100 font-medium text-[var(--chan-ink)]"
          >
            <XIcon className="text-[var(--chan-ink)]" />
            <span>Udostępnij na X</span>
          </div>

          <div
            onClick={() => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm hover:bg-[var(--chan-surface)] cursor-pointer transition-colors duration-100 font-medium text-[var(--chan-ink)]"
          >
            <Facebook size={16} className="text-[#1877F2]" />
            <span>Udostępnij na Facebook</span>
          </div>

          <div
            onClick={() => openWindow(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm hover:bg-[var(--chan-surface)] cursor-pointer transition-colors duration-100 font-medium text-[var(--chan-ink)]"
          >
            <MessageCircle size={16} className="text-[#25D366]" />
            <span>Wyślij przez WhatsApp</span>
          </div>

          <div
            onClick={() => openWindow(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm hover:bg-[var(--chan-surface)] cursor-pointer transition-colors duration-100 font-medium text-[var(--chan-muted)]"
          >
            <Mail size={16} />
            <span>Wyślij emailem</span>
          </div>
        </div>
      )}
    </div>
  );
}
