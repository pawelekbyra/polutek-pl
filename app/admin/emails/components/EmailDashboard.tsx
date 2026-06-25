"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, Send, AlertCircle, MessageSquare, Shield } from "@/app/components/icons";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

type EmailDiagnosticsStatus = {
    provider: string;
    webhooks: {
        status: "UNVERIFIED";
        label: string;
        message: string;
    };
};

export function EmailDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [diagnosticsStatus, setDiagnosticsStatus] = useState<EmailDiagnosticsStatus | null>(null);

    useEffect(() => {
        // Simplified stats for now
        fetch("/api/admin/emails/broadcast").then(res => res.json()).then(data => {
            if (Array.isArray(data)) {
                const total = data.reduce((acc, curr) => acc + curr.recipientCount, 0);
                const sent = data.length;
                setStats({ totalRecipients: total, broadcastsCount: sent, lastBroadcast: data[0] });
            }
        });

        fetch("/api/admin/emails/status")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) setDiagnosticsStatus(data);
            })
            .catch(() => setDiagnosticsStatus(null));
    }, []);

    const webhookLabel = diagnosticsStatus?.webhooks.label || "Niezweryfikowane";
    const webhookMessage = diagnosticsStatus?.webhooks.message || "Brak automatycznego health checku webhooków w panelu.";

    return (
        <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-neutral-500">Wysłane Broadcasty</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Send className="w-8 h-8 text-blue-600" />
                            <p className="text-3xl font-black">{stats?.broadcastsCount || 0}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-neutral-500">Łącznie Odbiorców</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Users className="w-8 h-8 text-green-600" />
                            <p className="text-3xl font-black">{stats?.totalRecipients || 0}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {stats?.lastBroadcast && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Ostatnia wysyłka</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-bold">{stats.lastBroadcast.subjectPl}</span>
                                <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-green-100 text-green-700">{stats.lastBroadcast.status}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-neutral-500">{format(new Date(stats.lastBroadcast.sentAt), 'PPp', { locale: pl })}</span>
                                <span className="font-bold">{stats.lastBroadcast.recipientCount} odbiorców</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="bg-neutral-900 text-white">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="w-5 h-5 text-amber-500" /> Status silnika
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Dostawca</span>
                            <span className="font-bold">{diagnosticsStatus?.provider || "Resend"}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Webhooki</span>
                            <span className="text-amber-300 font-bold flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {webhookLabel}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 italic leading-relaxed">{webhookMessage}</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
