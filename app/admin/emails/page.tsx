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
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";

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
    <div className="min-h-screen bg-muted/20 text-foreground pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Poczta" />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Poczta Admina</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">Zarządzanie komunikacją, szablonami i odpowiedziami od użytkowników.</p>
        </div>

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
                <TabsList className="w-full justify-start bg-background border rounded-lg p-1 mb-8 h-auto flex-wrap inline-flex">
                    <TabsTrigger value="dashboard" className="px-4 py-2 flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="px-4 py-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Szablony
                    </TabsTrigger>
                    <TabsTrigger value="broadcast" className="px-4 py-2 flex items-center gap-2">
                        <Send className="h-4 w-4" /> Nowa wysyłka
                    </TabsTrigger>
                    <TabsTrigger value="history" className="px-4 py-2 flex items-center gap-2">
                        <History className="h-4 w-4" /> Historia
                    </TabsTrigger>
                    <TabsTrigger value="responses" className="px-4 py-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Odpowiedzi
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="px-4 py-2 flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Ustawienia
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
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-blue-100 text-blue-600 mx-auto">
                            <Send className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Kreator wysyłki</h2>
                            <p className="text-muted-foreground">Przygotuj i wyślij wiadomość do swoich subskrybentów lub patronów.</p>
                        </div>
                        <Button size="lg" onClick={() => setIsCreatingBroadcast(true)}>
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
                            <div className="p-4 bg-muted/50 rounded-lg text-sm border">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Audience ID</p>
                                <p className="font-bold">
                                    {settingsStatus
                                        ? settingsStatus.audience.configured
                                            ? "Skonfigurowane po stronie serwera"
                                            : "Nie skonfigurowano po stronie serwera"
                                        : "Sprawdzanie konfiguracji..."}
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">Panel pokazuje wyłącznie bezpieczny status konfiguracji. Nie ujawnia wartości zmiennych środowiskowych ani sekretów.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        )}
      </main>
    </div>
  );
}
