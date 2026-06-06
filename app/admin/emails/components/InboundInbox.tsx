"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageSquare, Check, X, RotateCcw, User as UserIcon } from "@/app/components/icons";
import Link from "next/link";

type InboundEmail = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  text: string | null;
  status: string;
  userId: string | null;
  createdAt: string;
};

export function InboundInbox() {
    const [emails, setEmails] = useState<InboundEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchEmails();
    }, []);

    const fetchEmails = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/admin/emails/responses");
            const data = await res.json();
            if (Array.isArray(data)) setEmails(data);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        const res = await fetch("/api/admin/emails/responses", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status })
        });
        if (res.ok) fetchEmails();
    };

    if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-20 bg-neutral-100 rounded-xl" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase tracking-tight">Wiadomości przychodzące</h2>
                <Button variant="outline" size="sm" onClick={fetchEmails}><RotateCcw className="w-4 h-4 mr-2" /> Odśwież</Button>
            </div>

            <div className="grid gap-4">
                {emails.length === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="p-12 text-center text-neutral-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Brak nowych wiadomości.</p>
                        </CardContent>
                    </Card>
                )}
                {emails.map((email) => (
                    <div key={email.id} className={cn(
                        "bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4",
                        email.status === 'NEW' ? 'border-blue-200 ring-1 ring-blue-50' : 'border-neutral-200'
                    )}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-neutral-900">{email.fromName || email.fromEmail}</p>
                                    <p className="text-xs text-neutral-500">{email.fromEmail}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    {format(new Date(email.createdAt), 'PPp', { locale: pl })}
                                </span>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                    email.status === 'NEW' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                                )}>
                                    {email.status}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="font-bold text-sm">{email.subject || '(Brak tematu)'}</p>
                            <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{email.text}</p>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <div className="flex gap-2">
                                {email.userId && (
                                    <Link href={`/admin/users/${email.userId}`} className="text-xs font-bold text-blue-600 hover:underline flex items-center">
                                        Zobacz profil użytkownika →
                                    </Link>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {email.status === 'NEW' && (
                                    <Button size="sm" variant="ghost" onClick={() => updateStatus(email.id, 'READ')} className="text-xs font-bold text-neutral-500">
                                        Oznacz jako przeczytane
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => updateStatus(email.id, 'RESOLVED')} className="text-xs font-bold text-green-600 border-green-200 hover:bg-green-50">
                                    <Check className="w-4 h-4 mr-2" /> Załatwione
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateStatus(email.id, 'ARCHIVED')} className="text-xs font-bold text-neutral-400">
                                    Archiwizuj
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
