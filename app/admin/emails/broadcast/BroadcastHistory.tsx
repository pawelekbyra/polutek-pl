'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/app/hooks/useToast';
import { sanitizeEmailPreviewHtml } from '../sanitizeEmailPreviewHtml';

type BroadcastCounts = { pending: number; sent: number; failed: number; skipped: number };

type BroadcastLog = {
  id: string;
  subjectPl: string;
  subjectEn: string;
  htmlPl: string;
  htmlEn: string;
  status: string;
  recipientCount: number;
  counts: BroadcastCounts;
  sentAt: string | null;
  createdAt: string;
};

type BroadcastHistoryProps = {
  refreshToken?: number;
};

const STATUS_LABELS: Record<string, string> = {
  READY: 'W kolejce',
  SENDING: 'Wysyłanie',
  SENT: 'Wysłana',
  PARTIAL_FAILED: 'Częściowo nieudana',
  FAILED: 'Nieudana',
  CANCELLED: 'Anulowana',
  DRAFT: 'Szkic',
};

const isActive = (status: string) => status === 'READY' || status === 'SENDING';

export function BroadcastHistory({ refreshToken = 0 }: BroadcastHistoryProps) {
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const toast = useToast();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/emails/broadcast');
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch {
      // keep the last list; the next refresh tries again
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshToken]);

  // While a broadcast is going out, refresh its progress every few seconds.
  const anyActive = history.some((log) => isActive(log.status));
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(fetchHistory, 5000);
    return () => clearInterval(timer);
  }, [anyActive, fetchHistory]);

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/emails/broadcast/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) toast(`Anulowano. Pominięto ${data?.skipped ?? 0} niewysłanych.`, 'success');
      else toast(data?.error || 'Nie udało się anulować', 'error');
    } finally {
      setCancellingId(null);
      fetchHistory();
    }
  }

  if (isLoading) return <div className="animate-pulse h-20 bg-muted rounded-xl" />;
  if (history.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Nie było jeszcze żadnej rozsyłki.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">Historia rozsyłek</h2>
      <div className="grid gap-4">
        {history.map((log) => (
          <div key={log.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 flex justify-between items-center gap-4">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                aria-expanded={expandedId === log.id}
              >
                <h4 className="font-bold text-sm truncate text-foreground">{log.subjectPl}</h4>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">
                  {format(new Date(log.sentAt ?? log.createdAt), 'PPp', { locale: pl })} • {log.recipientCount} odbiorców
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wysłano {log.counts.sent}
                  {log.counts.pending > 0 && <> • czeka {log.counts.pending}</>}
                  {log.counts.failed > 0 && <> • nieudane {log.counts.failed}</>}
                  {log.counts.skipped > 0 && <> • pominięte {log.counts.skipped}</>}
                </p>
              </button>
              <div className="flex items-center gap-3">
                <span className={cn(
                    "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                    log.status === 'SENT' ? "bg-green-50 text-green-700 border-green-200" :
                    isActive(log.status) ? "bg-blue-50 text-blue-700 border-blue-200" :
                    log.status === 'FAILED' || log.status === 'PARTIAL_FAILED' ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-muted/50 text-foreground border"
                )}>
                  {STATUS_LABELS[log.status] ?? log.status}
                </span>
                {isActive(log.status) && (
                  <Button size="sm" variant="outline" disabled={cancellingId === log.id} onClick={() => cancel(log.id)}>
                    Anuluj
                  </Button>
                )}
              </div>
            </div>

            {expandedId === log.id && (
              <div className="border-t bg-muted/50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Wersja polska (PL)</h5>
                    <p className="text-xs font-bold text-foreground leading-tight">Temat: {log.subjectPl}</p>
                    <div className="bg-card border rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeEmailPreviewHtml(log.htmlPl) }} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Wersja angielska (EN)</h5>
                    {log.subjectEn ? (
                      <>
                        <p className="text-xs font-bold text-foreground leading-tight">Subject: {log.subjectEn}</p>
                        <div className="bg-card border rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                          <div dangerouslySetInnerHTML={{ __html: sanitizeEmailPreviewHtml(log.htmlEn) }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Brak: osoby z językiem angielskim dostały wersję polską.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
