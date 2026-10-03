"use client";

import Navbar from "@/app/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TemplatesList } from "./TemplatesList";
import { EmailTemplateEditor } from "./EmailTemplateEditor";
import { BroadcastWizard } from "./components/BroadcastWizard";
import { BroadcastHistory } from "./broadcast/BroadcastHistory";
import { FileText, Send, History } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";

export default function AdminEmailsPage() {
  const [activeTab, setActiveTab] = useState("templates");
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isCreatingBroadcast, setIsCreatingBroadcast] = useState(false);
  const [broadcastHistoryRefreshToken, setBroadcastHistoryRefreshToken] = useState(0);

  return (
    <div className="min-h-screen bg-muted/20 text-foreground pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Poczta" />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Poczta</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Treści maili wysyłanych przez serwis i rozsyłki do osób, które włączyły powiadomienia o nowych treściach.
            Poczta przychodząca (support@) trafia do PP Support, nie tutaj.
          </p>
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
                    <TabsTrigger value="templates" className="px-4 py-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Szablony
                    </TabsTrigger>
                    <TabsTrigger value="broadcast" className="px-4 py-2 flex items-center gap-2">
                        <Send className="h-4 w-4" /> Nowa rozsyłka
                    </TabsTrigger>
                    <TabsTrigger value="history" className="px-4 py-2 flex items-center gap-2">
                        <History className="h-4 w-4" /> Historia
                    </TabsTrigger>
                </TabsList>

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
                            <h2 className="text-2xl font-bold tracking-tight">Kreator rozsyłki</h2>
                            <p className="text-muted-foreground">
                                Wiadomość trafi tylko do osób, które włączyły powiadomienia o nowych treściach i nie są zablokowane
                                (odbicie, zgłoszenie spamu). Każda wiadomość dostaje stopkę z linkiem wypisu.
                            </p>
                        </div>
                        <Button size="lg" onClick={() => setIsCreatingBroadcast(true)}>
                            Rozpocznij kreator
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="focus-visible:outline-none">
                    <BroadcastHistory refreshToken={broadcastHistoryRefreshToken} />
                </TabsContent>
            </Tabs>
        )}
      </main>
    </div>
  );
}
