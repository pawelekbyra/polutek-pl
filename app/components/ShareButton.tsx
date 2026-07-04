"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Facebook, Mail, MessageCircle } from 'lucide-react';
import { Share2 } from './icons';
import { useShare } from '@/app/hooks/useShare';
import { cn } from '@/lib/utils';
import { Frame, NajsIcon, INK } from './najs/primitives';

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
          "relative flex items-center justify-center gap-2 h-[38px] px-5 active:scale-95 text-[#171717] font-bold text-[13.5px]",
          fill && "w-full",
          className
        )}
        style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
      >
        <Frame radius={20} seed={41} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
        <NajsIcon name="send" className="relative h-[17px] w-[17px]" stroke={INK} />
        <span className="relative">Szeruj</span>
      </button>

      {isOpen && !isMobile && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute bottom-[calc(100%+8px)] right-0 min-w-[240px] z-[1100]",
            "rounded-2xl border border-[#d8d0bd]/90 bg-[#f8f3e7]/98 p-1.5 shadow-[0_8px_26px_rgba(23,23,23,0.12)]",
            "animate-in fade-in-0 zoom-in-95 duration-150 slide-in-from-bottom-2"
          )}
        >
          <div
            onClick={() => copyToClipboard(url)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors duration-100 font-bold uppercase tracking-wider",
              copied ? "bg-[#eff3fe] text-primary" : "hover:bg-[#f1ead9] text-primary"
            )}
          >
            {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-primary" />}
            <span>{copied ? "Skopiowano!" : "Kopiuj link"}</span>
          </div>

          <div className="my-1 h-px bg-[#d8d0bd]/80" />

          <div
            onClick={() => openWindow(`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#f1ead9] cursor-pointer transition-colors duration-100 font-medium text-[#171717]"
          >
            <XIcon className="text-[#171717]" />
            <span>Szeruj na X</span>
          </div>

          <div
            onClick={() => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#f1ead9] cursor-pointer transition-colors duration-100 font-medium text-[#171717]"
          >
            <Facebook size={16} className="text-[#1877F2]" />
            <span>Szeruj na Facebook</span>
          </div>

          <div
            onClick={() => openWindow(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#f1ead9] cursor-pointer transition-colors duration-100 font-medium text-[#171717]"
          >
            <MessageCircle size={16} className="text-[#25D366]" />
            <span>Wyślij przez WhatsApp</span>
          </div>

          <div
            onClick={() => openWindow(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[#f1ead9] cursor-pointer transition-colors duration-100 font-medium text-[#171717]"
          >
            <Mail size={16} className="text-[#6b665d]" />
            <span>Wyślij emailem</span>
          </div>
        </div>
      )}
    </div>
  );
}