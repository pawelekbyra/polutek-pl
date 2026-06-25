"use client";

import Navbar from "@/app/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { EmailDashboard } from "./components/EmailDashboard";
import { TemplatesList } from "./TemplatesList";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { BroadcastWizard } from "./components/BroadcastWizard";
import { BroadcastHistory } from "./broadcast/BroadcastHistory";
import { InboundInbox } from "./components/InboundInbox";
import { LayoutDashboard, FileText, Send, History, MessageSquare, Settings } from "@/app/components/icons";
import { AdminBreadcrumbs } from "@/app/admin/components/AdminBreadcrumbs";

type EmailSettingsStatus = {
  audience: {
    configured: boolean;
  };
};

export default function AdminEmailsPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false);
  const [broadcastHistoryRefreshToken, setBroadcastHistoryRefreshToken] = useState(0);
  const [settingsStatus, setSettingsStatus] = useState<EmailSettingsStatus | null>(null);

  useEffect(() => {
    if (activeTab !== "settings") return;

    fetch("/api/admin/emails/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSettingsStatus(data);
      })
      .catch(() => setSettingsStatus(null));
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-neutral-50 text-foreground pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AdminBreadcrumbs
          items={[{ label: "Admin", href: "/admin" }, { label: "Maile" }]}
          backHref="/admin"
          backLabel="Wróć do panelu"
        />
        <header className="mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-neutral-900 mb-2">Poczta Admina</h1>
          <p className="text-neutral-500 font-medium italic">Zarządzanie komunikacją, szablonami i odpowiedziami od użytkowników.</p>
        </header>

        {editingTemplate ? (
            <EmailTemplateEditor
                templateSlug={editingTemplate}
                onBack={() => {
                    setEditingTemplate(null);
                    setActiveTab("templates");
                }}
            />
        ) : isCreatingBroadcast ? (
            <BroadcastWizard
                onBack={({ broadcastSent } = {}) => {
                    setIsCreatingBroadcast(false);
                    if (broadcastSent) {
                        setBroadcastHistoryRefreshToken((token) => token + 1);
                    }
                    setActiveTab("history");
                }}
            />
        ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                <TabsList className="bg-white border border-neutral-200 p-1 h-14 rounded-2xl shadow-sm inline-flex mb-8 overflow-x-auto max-w-full no-scrollbar">
                    <TabsTrigger value="dashboard" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Szablony
                    </TabsTrigger>
                    <TabsTrigger value="broadcast" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 bg-blue-50 text-blue-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <Send className="w-4 h-4" /> Nowa wysyłka
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <History className="w-4 h-4" /> Historia
                    </TabsTrigger>
                    <TabsTrigger value="responses" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Odpowiedzi
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Ustawienia
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="focus-visible:outline-none">
                    <EmailDashboard />
                </TabsContent>

                <TabsContent value="templates" className="focus-visible:outline-none">
                    <TemplatesList
                        onEdit={(slug) => setEditingTemplate(slug)}
                        onNew={() => setEditingTemplate("new")}
                    />
                </TabsContent>

                <TabsContent value="broadcast" className="focus-visible:outline-none">
                    <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                            <Send className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Kreator wysyłki</h2>
                            <p className="text-neutral-500 italic">Przygotuj i wyślij wiadomość do swoich subskrybentów lub patronów.</p>
                        </div>
                        <Button onClick={() => setIsCreatingBroadcast(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-12 h-14 font-black uppercase tracking-widest shadow-xl transition-all">
                            Rozpocznij kreator
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="focus-visible:outline-none">
                    <BroadcastHistory refreshToken={broadcastHistoryRefreshToken} />
                </TabsContent>

                <TabsContent value="responses" className="focus-visible:outline-none">
                    <InboundInbox />
                </TabsContent>

                <TabsContent value="settings" className="focus-visible:outline-none">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfiguracja Resend</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-neutral-100 rounded-lg text-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Audience ID</p>
                                <p className="font-bold text-neutral-900">
                                    {settingsStatus
                                        ? settingsStatus.audience.configured
                                            ? "Skonfigurowane po stronie serwera"
                                            : "Nie skonfigurowano po stronie serwera"
                                        : "Sprawdzanie konfiguracji..."}
                                </p>
                            </div>
                            <p className="text-xs text-neutral-500 italic">Panel pokazuje wyłącznie bezpieczny status konfiguracji. Nie ujawnia wartości zmiennych środowiskowych ani sekretów.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        )}
      </main>
    </div>
  );
}
