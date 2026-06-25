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
import { ArrowLeft, Send, Loader2, Check, Info, Users, UserAdd, Gem, Mail } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { cn } from "@/lib/utils";
import { sanitizeEmailPreviewHtml } from "../sanitizeEmailPreviewHtml";

type BroadcastWizardProps = {
    onBack: (result?: { broadcastSent?: boolean }) => void;
};

type RecipientGroup = 'ALL' | 'SUBSCRIBERS' | 'PATRONS' | 'MANUAL';

type RecipientGroupOption = {
    id: RecipientGroup;
    label: string;
    icon: typeof Users;
    desc: string;
};

const RECIPIENT_GROUP_OPTIONS: RecipientGroupOption[] = [
    { id: 'ALL', label: 'Wszyscy użytkownicy', icon: Users, desc: 'Wszystkie konta, które nie są usunięte' },
    { id: 'SUBSCRIBERS', label: 'Subskrybenci', icon: UserAdd, desc: 'Osoby obserwujące Twój kanał' },
    { id: 'PATRONS', label: 'Patroni', icon: Gem, desc: 'Aktywni wspierający' },
    { id: 'MANUAL', label: 'Ręczna lista', icon: Mail, desc: 'Wpisz adresy email oddzielone przecinkami' },
];

export function BroadcastWizard({ onBack }: BroadcastWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [subjectPl, setSubjectPl] = useState("");
    const [htmlPl, setHtmlPl] = useState("");
    const [subjectEn, setSubjectEn] = useState("");
    const [htmlEn, setHtmlEn] = useState("");
    const [recipientGroup, setRecipientGroup] = useState<RecipientGroup>('SUBSCRIBERS');
    const [manualEmails, setManualEmails] = useState("");
    const [testEmail, setTestEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const toast = useToast();

    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");

    useEffect(() => {
        fetch("/api/admin/templates").then(res => res.json()).then(setTemplates);
    }, []);

    const selectedRecipientGroup = useMemo(
        () => RECIPIENT_GROUP_OPTIONS.find((group) => group.id === recipientGroup) ?? RECIPIENT_GROUP_OPTIONS[1],
        [recipientGroup],
    );

    const manualRecipientCount = useMemo(() => {
        return manualEmails
            .split(',')
            .map((email) => email.trim())
            .filter(Boolean).length;
    }, [manualEmails]);

    const sanitizedHtmlPl = useMemo(
        () => sanitizeEmailPreviewHtml(htmlPl),
        [htmlPl],
    );

    const sanitizedHtmlEn = useMemo(
        () => sanitizeEmailPreviewHtml(htmlEn),
        [htmlEn],
    );

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

    const handleSendTest = async () => {
        setIsTesting(true);
        try {
            const res = await fetch("/api/admin/emails/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subjectPl, htmlPl, subjectEn, htmlEn,
                    isTest: true, testEmail
                })
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                toast("Wysłano testowy e-mail", "success");
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
                body: JSON.stringify({ subjectPl, htmlPl, subjectEn, htmlEn, recipientGroup, manualEmails })
            });
            const data = await res.json();
            if (res.ok) {
                toast(`Uruchomiono wysyłkę do ${data.recipientCount} osób`, "success");
                onBack({ broadcastSent: true });
            } else {
                toast(data.error || "Błąd wysyłki", "error");
            }
        } catch {
            toast("Błąd wysyłki", "error");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => onBack()} className="text-neutral-500 hover:text-neutral-900">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Anuluj
                </Button>
                <div className="flex gap-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={cn(
                            "w-8 h-1 rounded-full",
                            step >= s ? "bg-blue-600" : "bg-neutral-200"
                        )} />
                    ))}
                </div>
            </div>

            {step === 1 && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black uppercase tracking-tight">Krok 1: Treść wiadomości</h2>
                        <p className="text-neutral-500">Wybierz szablon lub wpisz treść od zera.</p>
                    </div>

                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <Label className="text-xs font-bold uppercase text-neutral-500">Zacznij od szablonu (opcjonalnie)</Label>
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

                    <div className="flex justify-end">
                        <Button onClick={() => setStep(2)} disabled={!subjectPl || !htmlPl} className="bg-neutral-900 text-white rounded-xl px-10">
                            Dalej: Odbiorcy
                        </Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black uppercase tracking-tight">Krok 2: Odbiorcy</h2>
                        <p className="text-neutral-500">Do kogo ma trafić ta wiadomość?</p>
                    </div>

                    <div className="grid gap-4">
                        {RECIPIENT_GROUP_OPTIONS.map((group) => (
                            <button
                                key={group.id}
                                onClick={() => setRecipientGroup(group.id)}
                                className={cn(
                                    "flex items-center gap-4 p-6 rounded-2xl border-2 text-left transition-all",
                                    recipientGroup === group.id ? "border-blue-600 bg-blue-50 shadow-md" : "border-neutral-100 bg-white hover:border-neutral-300"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center",
                                    recipientGroup === group.id ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-400"
                                )}>
                                    <group.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold">{group.label}</p>
                                    <p className="text-xs text-neutral-500">{group.desc}</p>
                                </div>
                                {recipientGroup === group.id && <Check className="w-6 h-6 text-blue-600" />}
                            </button>
                        ))}
                    </div>

                    {recipientGroup === 'MANUAL' && (
                        <Card className="mt-4 border-blue-200">
                            <CardContent className="p-4 space-y-2">
                                <Label className="text-xs font-bold uppercase text-blue-600">Adresy Email</Label>
                                <Textarea
                                    placeholder="email1@example.com, email2@example.com..."
                                    value={manualEmails}
                                    onChange={e => setManualEmails(e.target.value)}
                                    className="min-h-[100px]"
                                />
                                <p className="text-[10px] text-neutral-400 italic">Odbiorcy zostaną dodani do bazy jeśli jeszcze w niej nie istnieją.</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-between pt-6 border-t">
                        <Button variant="outline" onClick={() => setStep(1)}>Wróć</Button>
                        <Button onClick={() => setStep(3)} className="bg-neutral-900 text-white rounded-xl px-10">
                            Dalej: Test i wysyłka
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black uppercase tracking-tight">Krok 3: Podsumowanie</h2>
                        <p className="text-neutral-500">Sprawdź wszystko przed wysyłką.</p>
                    </div>

                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-6 flex gap-4">
                            <Info className="w-6 h-6 text-amber-600 shrink-0" />
                            <div className="space-y-4 w-full">
                                <p className="text-sm text-amber-900 font-medium italic">Zawsze wysyłaj test do siebie przed masową wysyłką.</p>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Twój e-mail..."
                                        value={testEmail}
                                        onChange={e => setTestEmail(e.target.value)}
                                        className="bg-white border-amber-200"
                                    />
                                    <Button onClick={handleSendTest} disabled={isTesting} variant="outline" className="border-amber-300 hover:bg-amber-100 text-amber-900 font-bold shrink-0">
                                        {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Wyślij test"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Odbiorcy</span>
                            <span className="text-sm font-black text-right">{selectedRecipientGroup.label}</span>
                        </div>
                        {recipientGroup === 'MANUAL' && (
                            <div className="flex justify-between border-b pb-2 gap-4">
                                <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Liczba ręcznych adresów</span>
                                <span className="text-sm font-black text-right">{manualRecipientCount}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Temat PL</span>
                            <span className="text-sm font-medium text-right">{subjectPl}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 gap-4">
                            <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Temat EN</span>
                            <span className="text-sm font-medium text-right">{subjectEn || '(Brak)'}</span>
                        </div>
                        <div className="space-y-2">
                            <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Podgląd HTML PL</span>
                            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 max-h-[320px] overflow-y-auto prose prose-sm prose-neutral">
                                <div dangerouslySetInnerHTML={{ __html: sanitizedHtmlPl }} />
                            </div>
                        </div>
                        {htmlEn && (
                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-neutral-400 tracking-widest">Podgląd HTML EN</span>
                                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 max-h-[320px] overflow-y-auto prose prose-sm prose-neutral">
                                    <div dangerouslySetInnerHTML={{ __html: sanitizedHtmlEn }} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between pt-6 border-t">
                        <Button variant="outline" onClick={() => setStep(2)}>Wróć</Button>
                        <Button
                            onClick={() => setIsSendDialogOpen(true)}
                            disabled={isSending}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-14 h-14 font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                            {isSending ? "Wysyłanie..." : "Wyślij Broadcast"}
                        </Button>
                    </div>
                </div>
            )}
        </div>

        <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Wysłać broadcast?</DialogTitle>
                    <DialogDescription>
                        Ta akcja uruchomi wysyłkę do wybranej grupy odbiorców. Przed wysyłką upewnij się, że test i podgląd są poprawne.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                        Anuluj
                    </DialogClose>
                    <Button variant="destructive" onClick={handleFinalSend} disabled={isSending}>
                        {isSending ? "Wysyłanie…" : "Wyślij broadcast"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
