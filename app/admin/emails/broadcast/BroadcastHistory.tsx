'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { sanitizeEmailPreviewHtml } from '../sanitizeEmailPreviewHtml';

interface BroadcastLog {
  id: string;
  subjectPl: string;
  htmlPl: string;
  subjectEn: string;
  htmlEn: string;
  recipientCount: number;
  sentAt: string;
  status: string;
  sentCount?: number;
}

type BroadcastHistoryProps = {
  refreshToken?: number;
};

export function BroadcastHistory({ refreshToken = 0 }: BroadcastHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/emails/broadcast');
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshToken]);

  if (isLoading) return <div className="animate-pulse h-20 bg-muted rounded-xl" />;
  if (history.length === 0) return null;

  return (
    <div className="mt-12 space-y-4">
      <h2 className="text-xl font-bold tracking-tight">Historia Wysyłek</h2>
      <div className="grid gap-4">
        {history.map((log) => (
          <div key={log.id} className="bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="min-w-0 flex-1 mr-4">
                <h4 className="font-bold text-sm truncate text-foreground">{log.subjectPl}</h4>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">
                  {format(new Date(log.sentAt), 'PPp', { locale: pl })} • {log.recipientCount} odbiorców
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block mr-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none mb-1">Dostarczono</p>
                    <p className="text-xs font-bold text-foreground leading-none">{log.sentCount ?? 0} / {log.recipientCount}</p>
                </div>
                <span className={cn(
                    "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border",
                    log.status === 'SENT' ? "bg-green-50 text-green-700 border-green-200" :
                    log.status === 'SENDING' ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse" :
                    "bg-muted/50 text-foreground border"
                )}>
                  {log.status}
                </span>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  {expandedId === log.id ? 'Ukryj' : 'Szczegóły'}
                </button>
              </div>
            </div>

            {expandedId === log.id && (
              <div className="border-t border bg-muted/50 p-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border pb-1">Wersja Polska (PL)</h5>
                    <p className="text-xs font-bold text-foreground leading-tight">Subject: {log.subjectPl}</p>
                    <div className="bg-card border rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeEmailPreviewHtml(log.htmlPl) }} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-blue-400 border-b border-blue-100 pb-1">English Version (EN)</h5>
                    <p className="text-xs font-bold text-foreground leading-tight">Subject: {log.subjectEn}</p>
                    <div className="bg-card border rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeEmailPreviewHtml(log.htmlEn) }} />
                    </div>
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
