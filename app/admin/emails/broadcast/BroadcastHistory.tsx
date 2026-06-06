'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BroadcastLog {
  id: string;
  subjectPl: string;
  htmlPl: string;
  subjectEn: string;
  htmlEn: string;
  recipientCount: number;
  sentAt: string;
  status: string;
}

export function BroadcastHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/emails/broadcast')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="animate-pulse h-20 bg-neutral-100 rounded-xl" />;
  if (history.length === 0) return null;

  return (
    <div className="mt-12 space-y-4">
      <h2 className="text-xl font-black uppercase tracking-tighter border-b-2 border-neutral-900 pb-2 inline-block text-neutral-900">Historia Wysyłek</h2>
      <div className="grid gap-4">
        {history.map((log) => (
          <div key={log.id} className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-neutral-50"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="min-w-0 flex-1 mr-4">
                <h4 className="font-bold text-sm truncate text-neutral-900">{log.subjectPl}</h4>
                <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-1">
                  {format(new Date(log.sentAt), 'PPp', { locale: pl })} • {log.recipientCount} odbiorców
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block mr-2">
                    <p className="text-[10px] font-black uppercase text-neutral-400 leading-none mb-1">Dostarczono</p>
                    <p className="text-xs font-bold text-neutral-900 leading-none">{log.sentCount} / {log.recipientCount}</p>
                </div>
                <span className={cn(
                    "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                    log.status === 'SENT' ? "bg-green-50 text-green-700 border-green-200" :
                    log.status === 'SENDING' ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse" :
                    "bg-neutral-50 text-neutral-700 border-neutral-200"
                )}>
                  {log.status}
                </span>
                <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
                  {expandedId === log.id ? 'Ukryj' : 'Szczegóły'}
                </button>
              </div>
            </div>

            {expandedId === log.id && (
              <div className="border-t border-neutral-100 bg-neutral-50 p-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 border-b border-neutral-200 pb-1">Wersja Polska (PL)</h5>
                    <p className="text-xs font-bold text-neutral-700 leading-tight">Subject: {log.subjectPl}</p>
                    <div className="bg-white border border-neutral-200 rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                      <div dangerouslySetInnerHTML={{ __html: log.htmlPl }} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 border-b border-blue-100 pb-1">English Version (EN)</h5>
                    <p className="text-xs font-bold text-neutral-700 leading-tight">Subject: {log.subjectEn}</p>
                    <div className="bg-white border border-neutral-200 rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner prose prose-sm prose-neutral">
                      <div dangerouslySetInnerHTML={{ __html: log.htmlEn }} />
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
