'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { useToast } from '@/app/hooks/useToast';
import { Loader2, Send } from '@/app/components/icons';

export function BroadcastEmailForm() {
  const [subjectPl, setSubjectPl] = useState('');
  const [htmlPl, setHtmlPl] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [htmlEn, setHtmlEn] = useState('');
  const [isSending, setIsPending] = useState(false);
  const toast = useToast();

  const handleSend = async () => {
    if (!subjectPl || !htmlPl || !subjectEn || !htmlEn) {
      toast("Proszę wypełnić wszystkie pola (PL i EN)", "error");
      return;
    }

    if (!confirm("Czy na pewno chcesz wysłać ten email do WSZYSTKICH subskrybentów?")) {
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch('/api/admin/emails/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectPl, htmlPl, subjectEn, htmlEn }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Wysłano do ${data.recipientCount} osób!`, "success");
        setSubjectPl('');
        setHtmlPl('');
        setSubjectEn('');
        setHtmlEn('');
      } else {
        toast(`Błąd: ${data.error}`, "error");
      }
    } catch (err) {
      logger.error("[BroadcastEmailForm] Failed to send", err);
      toast("Błąd połączenia", "error");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-8 bg-white p-8 rounded-xl border border-neutral-200 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-black uppercase tracking-tight text-lg border-b pb-2">Wersja Polska (PL)</h3>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-500">Temat</label>
            <Input
              value={subjectPl}
              onChange={(e) => setSubjectPl(e.target.value)}
              placeholder="Np. Nowy film na kanale!"
              className="font-sans"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-500">Treść HTML</label>
            <Textarea
              value={htmlPl}
              onChange={(e) => setHtmlPl(e.target.value)}
              placeholder="<h1>Cześć!</h1><p>Zapraszam do oglądania...</p>"
              className="font-mono min-h-[300px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-black uppercase tracking-tight text-lg border-b pb-2 text-blue-600">English Version (EN)</h3>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-500">Subject</label>
            <Input
              value={subjectEn}
              onChange={(e) => setSubjectEn(e.target.value)}
              placeholder="e.g. New video is out!"
              className="font-sans"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-500">HTML Content</label>
            <Textarea
              value={htmlEn}
              onChange={(e) => setHtmlEn(e.target.value)}
              placeholder="<h1>Hi!</h1><p>Check out our new video...</p>"
              className="font-mono min-h-[300px]"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <Button
          onClick={handleSend}
          disabled={isSending}
          size="lg"
          className="bg-charcoal hover:bg-black text-white px-10 h-14 rounded-full font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Send className="w-5 h-5 mr-2" />
          )}
          {isSending ? 'Wysyłanie...' : 'Wyślij Broadcast'}
        </Button>
      </div>
    </div>
  );
}
