"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, Send, AlertCircle, MessageSquare, Shield } from "@/app/components/icons";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export function EmailDashboard() {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        // Simplified stats for now
        fetch("/api/admin/emails/broadcast").then(res => res.json()).then(data => {
            if (Array.isArray(data)) {
                const total = data.reduce((acc, curr) => acc + curr.recipientCount, 0);
                const sent = data.length;
                setStats({ totalRecipients: total, broadcastsCount: sent, lastBroadcast: data[0] });
            }
        });
    }, []);

    return (
        <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-4">
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
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Dostawca</span>
                            <span className="font-bold">Resend</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400">Webhooki</span>
                            <span className="text-green-400 font-bold flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Aktywne
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
