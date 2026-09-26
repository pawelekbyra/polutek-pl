"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/app/hooks/useToast";
import { Loader2, Send } from "@/app/components/icons";

type Audience = "ALL" | "PATRONS";

export function NotificationBroadcastForm() {
  const [titlePl, setTitlePl] = useState("");
  const [bodyPl, setBodyPl] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [isSending, setIsSending] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const toast = useToast();

  const isValid = titlePl && bodyPl && titleEn && bodyEn;

  const handleSend = async () => {
    setIsSendDialogOpen(false);
    setIsSending(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titlePl, bodyPl, titleEn, bodyEn, audience }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Wysłano do ${data.recipientCount} osób!`, "success");
        setTitlePl("");
        setBodyPl("");
        setTitleEn("");
        setBodyEn("");
      } else {
        toast(`Błąd: ${data.error}`, "error");
      }
    } catch (err) {
      toast("Błąd połączenia", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wyślij powiadomienie</CardTitle>
        <CardDescription>
          Niestandardowe powiadomienie w aplikacji dla wybranej grupy użytkowników.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
      <div className="flex gap-2">
        {(["ALL", "PATRONS"] as const).map((a) => (
          <Button
            key={a}
            type="button"
            size="sm"
            variant={audience === a ? "default" : "outline"}
            onClick={() => setAudience(a)}
          >
            {a === "ALL" ? "Wszyscy zalogowani" : "Tylko Patroni"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h3 className="font-bold tracking-tight text-sm border-b pb-2">Wersja Polska (PL)</h3>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Tytuł</Label>
            <Input value={titlePl} onChange={(e) => setTitlePl(e.target.value)} placeholder="Np. Nowy film!" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Treść</Label>
            <Textarea value={bodyPl} onChange={(e) => setBodyPl(e.target.value)} className="min-h-[120px]" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold tracking-tight text-sm border-b pb-2 text-blue-600">English (EN)</h3>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Title</Label>
            <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. New video!" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Body</Label>
            <Textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} className="min-h-[120px]" />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t flex justify-end">
        <Button
          onClick={() => {
            if (!isValid) {
              toast("Proszę wypełnić wszystkie pola (PL i EN)", "error");
              return;
            }
            setIsSendDialogOpen(true);
          }}
          disabled={isSending}
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {isSending ? "Wysyłanie…" : "Wyślij powiadomienie"}
        </Button>
      </div>
      </CardContent>

      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wysłać powiadomienie?</DialogTitle>
            <DialogDescription>
              Ta akcja wyśle powiadomienie w aplikacji do grupy: {audience === "ALL" ? "wszyscy zalogowani" : "tylko Patroni"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Anuluj</DialogClose>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? "Wysyłanie…" : "Wyślij"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
