"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Globe, Info, Plus, Check, Shield } from "@/app/components/icons";
import { sanitizeEmailPreviewHtml } from "./sanitizeEmailPreviewHtml";

type EmailTemplateEditorProps = {
  templateSlug: string;
  onBack: () => void;
};

const CATEGORIES = ['SYSTEM', 'WELCOME', 'PAYMENT', 'PATRON', 'BROADCAST', 'MANUAL', 'OTHER'];
const VARIABLES = [
    { key: '{{firstName}}', label: 'Imię' },
    { key: '{{name}}', label: 'Pełna nazwa' },
    { key: '{{email}}', label: 'E-mail odbiorcy' },
    { key: '{{amount}}', label: 'Kwota' },
    { key: '{{currency}}', label: 'Waluta' },
    { key: '{{appName}}', label: 'Nazwa aplikacji' },
    { key: '{{appUrl}}', label: 'URL aplikacji' },
    { key: '{{unsubscribeLink}}', label: 'Link wypisu' },
];

export function EmailTemplateEditor({ templateSlug, onBack }: EmailTemplateEditorProps) {
  const [slug, setSlug] = useState(templateSlug);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [isActive, setIsActive] = useState(true);
  const [isSystem, setIsSystem] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [subjectEn, setSubjectEn] = useState("");
  const [htmlEn, setHtmlEn] = useState("");
  const [activeTab, setActiveTab] = useState<"pl" | "en">("pl");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templateSlug !== "new") {
        setStatus("loading");
        fetch(`/api/admin/templates?slug=${templateSlug}`)
            .then(res => res.json())
            .then(data => {
                setSlug(data.slug);
                setName(data.name || "");
                setDescription(data.description || "");
                setCategory(data.category || "OTHER");
                setIsActive(data.isActive ?? true);
                setIsSystem(data.isSystem ?? false);
                setSubject(data.subject || "");
                setHtml(data.html || "");
                setSubjectEn(data.subjectEn || "");
                setHtmlEn(data.htmlEn || "");
                setStatus("idle");
            });
    }
  }, [templateSlug]);

  const previewHtml = useMemo(() => {
    return html
      .replaceAll("{{firstName}}", "Jan")
      .replaceAll("{{name}}", "Jan Kowalski")
      .replaceAll("{{email}}", "jan@example.com")
      .replaceAll("{{amount}}", "100.00")
      .replaceAll("{{currency}}", "PLN")
      .replaceAll("{{appName}}", "Polutek.pl")
      .replaceAll("{{appUrl}}", "https://polutek.pl")
      .replaceAll("{{unsubscribeLink}}", "#");
  }, [html]);

  const previewHtmlEn = useMemo(() => {
    return htmlEn
      .replaceAll("{{firstName}}", "John")
      .replaceAll("{{name}}", "John Doe")
      .replaceAll("{{email}}", "john@example.com")
      .replaceAll("{{amount}}", "25.00")
      .replaceAll("{{currency}}", "USD")
      .replaceAll("{{appName}}", "Polutek.pl")
      .replaceAll("{{appUrl}}", "https://polutek.pl")
      .replaceAll("{{unsubscribeLink}}", "#");
  }, [htmlEn]);

  const sanitizedPreviewHtml = useMemo(
    () => sanitizeEmailPreviewHtml(previewHtml),
    [previewHtml],
  );

  const sanitizedPreviewHtmlEn = useMemo(
    () => sanitizeEmailPreviewHtml(previewHtmlEn),
    [previewHtmlEn],
  );

  async function handleSave() {
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slug,
            name,
            description,
            category,
            isActive,
            subject,
            html,
            subjectEn,
            htmlEn
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Nie udało się zapisać szablonu.");
      }

      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać szablonu.");
      setStatus("error");
    }
  }

  const insertVariable = (variable: string) => {
    if (activeTab === "en") {
      setHtmlEn(prev => prev + " " + variable);
    } else {
      setHtml(prev => prev + " " + variable);
    }
  };

  if (status === "loading") return <div className="animate-pulse h-96 bg-neutral-100 rounded-xl" />;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBack} className="text-neutral-500 hover:text-neutral-900">
                <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
            </Button>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
                    <Checkbox id="active-switch" checked={isActive} onCheckedChange={(checked: boolean | "indeterminate") => setIsActive(!!checked)} />
                    <Label htmlFor="active-switch" className="text-[10px] font-black uppercase text-neutral-500 cursor-pointer">Aktywny</Label>
                </div>
                <Button onClick={handleSave} disabled={status === "saving" || !subject.trim() || !html.trim()} className="bg-neutral-900 hover:bg-black text-white rounded-xl px-8 h-10">
                    <Save className="w-4 h-4 mr-2" /> {status === "saving" ? "Zapisuję..." : "Zapisz szablon"}
                </Button>
            </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Podstawowe informacje</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-neutral-500">Slug (ID unikalne)</Label>
                                <Input value={slug} onChange={e => setSlug(e.target.value)} disabled={templateSlug !== 'new'} placeholder="np. promo-jesien" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-neutral-500">Kategoria</Label>
                                <Select value={category} onValueChange={(val) => setCategory(val || 'OTHER')}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-neutral-500">Nazwa wewnętrzna</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Przyjazna nazwa szablonu" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-neutral-500">Opis</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Do czego służy ten szablon?" />
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="pl" onValueChange={(v) => setActiveTab(v as "pl" | "en")}>
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="pl">Polski</TabsTrigger>
                        <TabsTrigger value="en">Angielski</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pl" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Temat wiadomości (PL)</CardTitle>
                                <CardDescription>Obsługuje zmienne w formacie <code>{"{{firstName}}"}</code>.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card className="min-h-[500px]">
                                <CardHeader>
                                    <CardTitle>Edytor HTML (PL)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        value={html}
                                        onChange={(event) => setHtml(event.target.value)}
                                        className="min-h-[400px] font-mono text-xs"
                                        spellCheck={false}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="min-h-[500px]">
                                <CardHeader>
                                    <CardTitle>Podgląd (PL)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="min-h-[400px] overflow-auto rounded-lg border bg-white p-4 shadow-inner text-black">
                                        <div dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="en" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Subject (EN)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Input value={subjectEn} onChange={(event) => setSubjectEn(event.target.value)} />
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card className="min-h-[500px]">
                                <CardHeader>
                                    <CardTitle>HTML Editor (EN)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        value={htmlEn}
                                        onChange={(event) => setHtmlEn(event.target.value)}
                                        className="min-h-[400px] font-mono text-xs"
                                        spellCheck={false}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="min-h-[500px]">
                                <CardHeader>
                                    <CardTitle>Preview (EN)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="min-h-[400px] overflow-auto rounded-lg border bg-white p-4 shadow-inner text-black">
                                        <div dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtmlEn }} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" /> Zmienne
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {VARIABLES.map(v => (
                                <button
                                    key={v.key}
                                    onClick={() => insertVariable(v.key)}
                                    className="flex items-center justify-between p-2 rounded border border-neutral-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left"
                                >
                                    <div>
                                        <code className="text-xs font-bold text-blue-700">{v.key}</code>
                                        <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">{v.label}</p>
                                    </div>
                                    <Plus className="w-3 h-3 text-neutral-300" />
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {isSystem && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-sm">
                        <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Szablon systemowy</p>
                            <p className="text-[10px] leading-relaxed text-amber-700 mt-1">
                                Używany przez aplikację. Edycja dozwolona, usuwanie zablokowane.
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-sm space-y-2">
                    <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Status operacji</p>
                    {status === "saved" && <p className="text-green-600 font-bold text-xs">✓ Szablon został zapisany</p>}
                    {status === "error" && <p className="text-destructive font-bold text-xs">✕ {error}</p>}
                    {status === "saving" && <p className="text-blue-600 animate-pulse font-bold text-xs italic">Zapisywanie...</p>}
                    {status === "idle" && <p className="text-neutral-400 text-xs">Gotowy do zmian</p>}
                </div>
            </div>
        </div>
    </div>
  );
}
