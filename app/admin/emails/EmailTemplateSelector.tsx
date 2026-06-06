'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  { slug: 'welcome-email', label: 'Powitanie (Rejestracja)' },
  { slug: 'become-patron', label: 'Zostałeś Patronem (Pierwsza wpłata)' },
  { slug: 'thank-you-donation', label: 'Dziękujemy za wsparcie (Kolejne wpłaty)' },
  { slug: 'password-changed', label: 'Zmiana hasła' },
  { slug: 'account-deleted', label: 'Usunięcie konta' },
];

interface EmailTemplateSelectorProps {
  currentSlug: string;
  onSelect: (slug: string) => void;
}

export function EmailTemplateSelector({ currentSlug, onSelect }: EmailTemplateSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {TEMPLATES.map((t) => (
        <button
          key={t.slug}
          onClick={() => onSelect(t.slug)}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all",
            currentSlug === t.slug
              ? "bg-neutral-900 text-white border-neutral-900 shadow-lg"
              : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900 hover:text-neutral-900"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
