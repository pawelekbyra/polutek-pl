"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Loader2, Info, Users } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { cn } from "@/lib/utils";
import { sanitizeEmailPreviewHtml } from "../sanitizeEmailPreviewHtml";

type BroadcastWizardProps = {
    onBack: (result?: { broadcastSent?: boolean }) => void;
};

type TemplateOption = { id: string; slug: string; name: string | null; isSystem: boolean; subject: string; html: string; subjectEn: string | null; htmlEn: string | null };

/**
 * Three steps: content, audience (the one lawful group, with the current count), test and send.
 * "Send" only queues the broadcast; the server sends it in the background at a safe pace. The
 * request key is fixed for the life of the wizard, so a double click or a retry never creates a
 * second broadcast.
 */
export function BroadcastWizard({ onBack }: BroadcastWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [subjectPl, setSubjectPl] = useState("");
    const [htmlPl, setHtmlPl] = useState("");
    const [subjectEn, setSubjectEn] = useState("");
    const [htmlEn, setHtmlEn] = useState("");
    const [testLanguage, setTestLanguage] = useState<"pl" | "en">("pl");
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [requestKey] = useState(() => crypto.randomUUID());
    const toast = useToast();

    const [templates, setTemplates] = useState<TemplateOption[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/admin/templates")
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load templates (${res.status})`);
                return res.json();
            })
            .then((data) => {
                // Own templates only: system mails (verification, reset…) are not broadcast content.
                if (!cancelled) setTemplates(Array.isArray(data) ? data.filter((t: TemplateOption) => !t.isSystem) : []);
            })
            .catch(() => {
                if (!cancelled) {
                    toast("Nie udało się wczytać szablonów wiadomości.", "error");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [toast]);

    useEffect(() => {
        if (step !== 2) return;
        let cancelled = false;
        setAudienceCount(null);
        fetch("/api/admin/emails/broadcast/audience")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) setAudienceCount(typeof data?.recipientCount === "number" ? data.recipientCount : 0);
            })
            .catch(() => {
                if (!cancelled) setAudienceCount(0);
            });
        return () => {
            cancelled = true;
        };
    }, [step]);

    const sanitizedHtmlPl = useMemo(() => sanitizeEmailPreviewHtml(htmlPl), [htmlPl]);
    const sanitizedHtmlEn = useMemo(() => sanitizeEmailPreviewHtml(htmlEn), [htmlEn]);
    const englishIncomplete = Boolean(subjectEn.trim()) !== Boolean(htmlEn.trim());

    const handleTemplateSelect = (slug: string) => {
        const t = templates.find(temp => temp.slug === slug);
        if (t) {
            setSubjectPl(t.subject || "");
            setHtmlPl(t.html || "");
            setSubjectEn(t.subjectEn || "");
            setHtmlEn(t.htmlEn || "");
            setSelectedTemplate(slug);
        }
    };

    const content = { subjectPl, htmlPl, subjectEn: subjectEn || null, htmlEn: htmlEn || null };

    const handleSendTest = async () => {
        setIsTesting(true);
        try {
            const res = await fetch("/api/admin/emails/broadcast/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...content, language: testLanguage }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                toast(`Wysłano test na ${data?.to ?? "Twój adres"}`, "success");
            } else {
                toast(data?.error || "Nie udało się wysłać testowego e-maila", "error");
            }
        } catch {
            toast("Nie udało się wysłać testowego e-maila", "error");
        } finally {
            setIsTesting(false);
        }
    };

    const handleFinalSend = async () => {
        setIsSendDialogOpen(false);
        setIsSending(true);
        try {
            const res = await fetch("/api/admin/emails/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...content, requestKey }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                toast(`Rozsyłka do ${data?.recipientCount ?? 0} osób jest w kolejce; postęp widać w historii.`, "success");
                onBack({ broadcastSent: true });
            } else {
                toast(data?.error || "Nie udało się utworzyć rozsyłki", "error");
            }
        } catch {
            toast("Brak odpowiedzi serwera. Kliknij „Wyślij” jeszcze raz: ta sama rozsyłka nie zostanie utworzona drugi raz.", "error");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => onBack()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Anuluj
                </Button>
                <div className="flex gap-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={cn(
                            "w-8 h-1 rounded-full",
                            step >= s ? "bg-blue-600" : "bg-muted"
                        )} />
                    ))}
                </div>
            </div>

            {step === 1 && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Krok 1: Treść wiadomości</h2>
                        <p className="text-muted-foreground">
                            Wybierz własny szablon lub wpisz treść od zera. Stopkę z linkiem wypisu serwis dodaje sam.
                        </p>
                    </div>

                    {templates.length > 0 && (
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Zacznij od szablonu (opcjonalnie)</Label>
                                <Select value={selectedTemplate} onValueChange={(val) => val && handleTemplateSelect(val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz szablon..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map(t => <SelectItem key={t.id} value={t.slug}>{t.name || t.slug}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    )}

                    <Tabs defaultValue="pl">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="pl">Polski</TabsTrigger>
                            <TabsTrigger value="en">Angielski</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pl" className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Temat (PL)</Label>
                                <Input value={subjectPl} onChange={e => setSubjectPl(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Treść HTML (PL)</Label>
                                <Textarea value={htmlPl} onChange={e => setHtmlPl(e.target.value)} className="min-h-[300px] font-mono text-sm" />
                            </div>
                        </TabsContent>
                        <TabsContent value="en" className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Opcjonalnie. Osoby z językiem angielskim dostaną tę wersję; bez niej dostaną wersję polską.
                            </p>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Subject (EN)</Label>
                                <Input value={subjectEn} onChange={e => setSubjectEn(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">HTML Content (EN)</Label>
                                <Textarea value={htmlEn} onChange={e => setHtmlEn(e.target.value)} className="min-h-[300px] font-mono text-sm" />
                            </div>
                        </TabsContent>
                    </Tabs>

                    {englishIncomplete && (
                        <p role="alert" className="text-sm text-destructive">Wersja angielska musi mieć i temat, i treść (albo zostaw obie puste).</p>
                    )}

                    <div className="flex justify-end">
                        <Button onClick={() => setStep(2)} disabled={!subjectPl.trim() || !htmlPl.trim() || englishIncomplete}>
                            Dalej: Odbiorcy
                        </Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Krok 2: Odbiorcy</h2>
                    </div>

                    <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-600 text-white">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold">Subskrybenci z włączonymi powiadomieniami</p>
                                <p className="text-xs text-muted-foreground">
                                    Osoby, które subskrybują kanał i zgodziły się na e-maile o nowych treściach. Pomijamy adresy zablokowane po odbiciu lub zgłoszeniu spamu.
                                </p>
                            </div>
                            <p className="text-2xl font-black" aria-live="polite">
                                {audienceCount === null ? <Loader2 className="w-5 h-5 animate-spin" /> : audienceCount}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between pt-6 border-t">
                        <Button variant="outline" onClick={() => setStep(1)}>Wróć</Button>
                        <Button onClick={() => setStep(3)} disabled={!audienceCount}>
                            Dalej: Test i wysyłka
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Krok 3: Podsumowanie</h2>
                        <p className="text-muted-foreground">Sprawdź wszystko przed wysyłką.</p>
                    </div>

                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-6 flex gap-4">
                            <Info className="w-6 h-6 text-amber-600 shrink-0" />
                            <div className="space-y-4 w-full">
                                <p className="text-sm text-amber-900 font-medium">
                                    Test przychodzi na adres Twojego konta i wygląda dokładnie jak prawdziwa wiadomość (ze stopką i linkiem wypisu).
                                </p>
                                <div className="flex gap-2">
                                    <Select value={testLanguage} onValueChange={(val) => setTestLanguage(val === "en" ? "en" : "pl")}>
                                        <SelectTrigger className="bg-white border-amber-200 w-40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pl">Wersja PL</SelectItem>
                                            <SelectItem value="en">Wersja EN</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleSendTest} disabled={isTesting} variant="outline" className="border-amber-300 hover:bg-amber-100 text-amber-900 font-bold shrink-0">
                                        {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Wyślij test do siebie"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Odbiorcy</span>
                            <span className="text-sm font-black text-right">{audienceCount ?? "…"} osób</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Temat PL</span>
                            <span className="text-sm font-medium text-right">{subjectPl}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Temat EN</span>
                            <span className="text-sm font-medium text-right">{subjectEn || "(brak, wyślemy wersję PL)"}</span>
                        </div>
                        <div className="space-y-2">
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Podgląd HTML PL</span>
                            <div className="bg-muted/50 border rounded-xl p-4 max-h-[320px] overflow-y-auto prose prose-sm">
                                <div dangerouslySetInnerHTML={{ __html: sanitizedHtmlPl }} />
                            </div>
                        </div>
                        {htmlEn && (
                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Podgląd HTML EN</span>
                                <div className="bg-muted/50 border rounded-xl p-4 max-h-[320px] overflow-y-auto prose prose-sm">
                                    <div dangerouslySetInnerHTML={{ __html: sanitizedHtmlEn }} />
                                </div>
                            </div>
                        )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-between pt-6 border-t">
                        <Button variant="outline" onClick={() => setStep(2)}>Wróć</Button>
                        <Button
                            size="lg"
                            onClick={() => setIsSendDialogOpen(true)}
                            disabled={isSending}
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                            {isSending ? "Zapisywanie…" : "Wyślij rozsyłkę"}
                        </Button>
                    </div>
                </div>
            )}
        </div>

        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Wysłać rozsyłkę?</DialogTitle>
                    <DialogDescription>
                        Wiadomość trafi do {audienceCount ?? "wybranych"} osób. Wysyłka idzie w tle, kilka maili na sekundę; postęp i przycisk „Anuluj” są w historii.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                        Anuluj
                    </DialogClose>
                    <Button onClick={handleFinalSend} disabled={isSending}>
                        {isSending ? "Zapisywanie…" : "Wyślij rozsyłkę"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
