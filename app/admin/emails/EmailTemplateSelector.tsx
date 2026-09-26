'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

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
        <Button
          key={t.slug}
          size="sm"
          variant={currentSlug === t.slug ? "default" : "outline"}
          onClick={() => onSelect(t.slug)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
