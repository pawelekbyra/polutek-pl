"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Info, Plus, Shield } from "@/app/components/icons";
import { sanitizeEmailPreviewHtml } from "./sanitizeEmailPreviewHtml";

type EmailTemplateEditorProps = {
  templateSlug: string;
  onBack: () => void;
};

type TemplateVariable = { key: string; label: string; sample: { pl: string; en: string } };

/** Preview with the example values the server defines for each variable. */
function fillSamples(text: string, variables: TemplateVariable[], language: "pl" | "en") {
  const samples = new Map(variables.map((v) => [v.key, v.sample[language]]));
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key: string) => samples.get(key) ?? match);
}

export function EmailTemplateEditor({ templateSlug, onBack }: EmailTemplateEditorProps) {
  const isNew = templateSlug === "new";
  const [slug, setSlug] = useState(isNew ? "" : templateSlug);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSystem, setIsSystem] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [subjectEn, setSubjectEn] = useState("");
  const [htmlEn, setHtmlEn] = useState("");
  const [activeTab, setActiveTab] = useState<"pl" | "en">("pl");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const url = isNew ? "/api/admin/templates?variables=custom" : `/api/admin/templates?slug=${encodeURIComponent(templateSlug)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load template (status ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setVariables(Array.isArray(data.variables) ? data.variables : []);
        if (!isNew) {
          setSlug(data.slug);
          setName(data.name || "");
          setDescription(data.description || "");
          setIsSystem(Boolean(data.isSystem));
          setIsCustomized(Boolean(data.isCustomized));
          setSubject(data.subject || "");
          setHtml(data.html || "");
          setSubjectEn(data.subjectEn || "");
          setHtmlEn(data.htmlEn || "");
        }
        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Nie udało się wczytać szablonu.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [templateSlug, isNew, reloadToken]);

  const sanitizedPreviewHtml = useMemo(
    () => sanitizeEmailPreviewHtml(fillSamples(html, variables, "pl")),
    [html, variables],
  );
  const sanitizedPreviewHtmlEn = useMemo(
    () => sanitizeEmailPreviewHtml(fillSamples(htmlEn, variables, "en")),
    [htmlEn, variables],
  );

  async function handleSave() {
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, description, subject, html, subjectEn, htmlEn }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Nie udało się zapisać szablonu.");
      }

      setIsCustomized(true);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać szablonu.");
      setStatus("error");
    }
  }

  async function handleRestoreDefault() {
    setStatus("saving");
    setError(null);
    const response = await fetch(`/api/admin/templates?slug=${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError("Nie udało się przywrócić tekstu domyślnego.");
      setStatus("error");
      return;
    }
    setReloadToken((token) => token + 1);
  }

  const insertVariable = (variable: string) => {
    if (activeTab === "en") {
      setHtmlEn(prev => prev + " " + variable);
    } else {
      setHtml(prev => prev + " " + variable);
    }
  };

  if (status === "loading") return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
            </Button>
            <div className="flex items-center gap-2">
                {isSystem && isCustomized && (
                    <Button variant="outline" onClick={handleRestoreDefault} disabled={status === "saving"}>
                        Przywróć domyślny
                    </Button>
                )}
                <Button onClick={handleSave} disabled={status === "saving" || !slug.trim() || !subject.trim() || !html.trim()}>
                    <Save className="w-4 h-4 mr-2" /> {status === "saving" ? "Zapisuję..." : "Zapisz szablon"}
                </Button>
            </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
                {!isSystem && (
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Podstawowe informacje</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Slug (ID unikalne)</Label>
                                <Input value={slug} onChange={e => setSlug(e.target.value)} disabled={!isNew} placeholder="np. nowy-film" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Nazwa wewnętrzna</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Przyjazna nazwa szablonu" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Opis</Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Do czego służy ten szablon?" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="pl" onValueChange={(v) => setActiveTab(v as "pl" | "en")}>
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="pl">Polski</TabsTrigger>
                        <TabsTrigger value="en">Angielski</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pl" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Temat wiadomości (PL)</CardTitle>
                                <CardDescription>Obsługuje zmienne z listy obok, np. <code>{"{{brandName}}"}</code>.</CardDescription>
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
                        <CardDescription>Tylko te zmienne są wypełniane; zapis z inną zmienną zostanie odrzucony.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {variables.map(v => (
                                <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => insertVariable(`{{${v.key}}}`)}
                                    className="flex items-center justify-between p-2 rounded border hover:bg-blue-50 hover:border-blue-200 transition-all text-left"
                                >
                                    <div>
                                        <code className="text-xs font-bold text-blue-700">{`{{${v.key}}}`}</code>
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{v.label}</p>
                                    </div>
                                    <Plus className="w-3 h-3 text-muted-foreground/50" />
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {isSystem && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-sm">
                        <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">
                                {name || slug} · {isCustomized ? "zmieniony" : "domyślny"}
                            </p>
                            <p className="text-[10px] leading-relaxed text-amber-700 mt-1">
                                {description} {isCustomized
                                    ? "Wysyłana jest Twoja wersja. „Przywróć domyślny” wraca do tekstu z kodu."
                                    : "Wysyłany jest tekst domyślny z kodu. Zapisanie zmian zastąpi go Twoją wersją."}
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-4 bg-card border rounded-xl space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Status operacji</p>
                    {status === "saved" && <p className="text-green-600 font-bold text-xs">✓ Szablon został zapisany</p>}
                    {status === "error" && <p className="text-destructive font-bold text-xs">✕ {error}</p>}
                    {status === "saving" && <p className="text-blue-600 animate-pulse font-bold text-xs">Zapisywanie...</p>}
                    {status === "idle" && <p className="text-muted-foreground text-xs">Gotowy do zmian</p>}
                </div>
            </div>
        </div>
    </div>
  );
}
