'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface BroadcastLog {
  id: string;
  subjectPl: string;
  recipientCount: number;
  sentAt: string;
  status: string;
}

export function BroadcastHistory() {
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      <h2 className="text-xl font-black uppercase tracking-tighter border-b-2 border-neutral-900 pb-2 inline-block">Historia Wysyłek</h2>
      <div className="grid gap-4">
        {history.map((log) => (
          <div key={log.id} className="bg-white border border-neutral-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div className="min-w-0 flex-1 mr-4">
              <h4 className="font-bold text-sm truncate">{log.subjectPl}</h4>
              <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-1">
                {format(new Date(log.sentAt), 'PPp', { locale: pl })} • {log.recipientCount} odbiorców
              </p>
            </div>
            <div className="shrink-0">
               <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-green-200">
                 {log.status}
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
