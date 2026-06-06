"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmailTemplateSelector } from "./EmailTemplateSelector";
import { useEffect } from "react";

type EmailTemplateEditorProps = {
  initialTemplate: {
    slug: string;
    subject: string;
    html: string;
    subjectEn?: string | null;
    htmlEn?: string | null;
  };
};

export function EmailTemplateEditor({ initialTemplate }: EmailTemplateEditorProps) {
  const [slug, setSlug] = useState(initialTemplate.slug);
  const [subject, setSubject] = useState(initialTemplate.subject);
  const [html, setHtml] = useState(initialTemplate.html);
  const [subjectEn, setSubjectEn] = useState(initialTemplate.subjectEn || "");
  const [htmlEn, setHtmlEn] = useState(initialTemplate.htmlEn || "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(() => {
    return html
      .replaceAll("{{firstName}}", "Jan")
      .replaceAll("{{amount}}", "100.00")
      .replaceAll("{{currency}}", "PLN")
      .replaceAll("{{appName}}", "Polutek.pl")
      .replaceAll("{{appUrl}}", "https://polutek.pl");
  }, [html]);

  const previewHtmlEn = useMemo(() => {
    return htmlEn
      .replaceAll("{{firstName}}", "John")
      .replaceAll("{{amount}}", "25.00")
      .replaceAll("{{currency}}", "USD")
      .replaceAll("{{appName}}", "Polutek.pl")
      .replaceAll("{{appUrl}}", "https://polutek.pl");
  }, [htmlEn]);

  useEffect(() => {
    if (slug !== initialTemplate.slug) {
        setStatus("saving");
        fetch(`/api/admin/templates?slug=${slug}`)
            .then(res => res.json())
            .then(data => {
                setSubject(data.subject || "");
                setHtml(data.html || "");
                setSubjectEn(data.subjectEn || "");
                setHtmlEn(data.htmlEn || "");
                setStatus("idle");
            });
    }
  }, [slug, initialTemplate.slug]);

  async function handleSave() {
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, subject, html, subjectEn, htmlEn }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Nie udało się zapisać szablonu.");
      }

      const saved = await response.json();
      setSubject(saved.subject);
      setHtml(saved.html);
      setSubjectEn(saved.subjectEn || "");
      setHtmlEn(saved.htmlEn || "");
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać szablonu.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
        <EmailTemplateSelector currentSlug={slug} onSelect={setSlug} />

        <div className="bg-neutral-100 p-4 rounded-lg mb-6">
             <p className="text-sm text-neutral-600 font-medium">
              Edytujesz szablon: <code className="bg-white px-2 py-0.5 rounded border border-neutral-300 font-bold text-neutral-900">{slug}</code>
            </p>
            <p className="text-xs text-neutral-500 mt-1 italic">
                Dostępne zmienne: <code>{"{{firstName}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{currency}}"}</code>, <code>{"{{appName}}"}</code>, <code>{"{{appUrl}}"}</code>.
            </p>
        </div>

        <Tabs defaultValue="pl">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pl">Polski</TabsTrigger>
            <TabsTrigger value="en">Angielski</TabsTrigger>
          </TabsList>

          <TabsContent value="pl" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Temat wiadomości (PL)</CardTitle>
                <CardDescription>Temat jest zapisywany razem z HTML-em i także obsługuje zmienne w formacie <code>{"{{firstName}}"}</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="min-h-[640px]">
                <CardHeader>
                  <CardTitle>Edytor HTML (PL)</CardTitle>
                  <CardDescription>Wklej lub zmień surowy kod HTML wiadomości.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={html}
                    onChange={(event) => setHtml(event.target.value)}
                    className="min-h-[520px] resize-y font-mono text-xs leading-relaxed"
                    spellCheck={false}
                  />
                </CardContent>
              </Card>

              <Card className="min-h-[640px]">
                <CardHeader>
                  <CardTitle>Podgląd na żywo (PL)</CardTitle>
                  <CardDescription>Podgląd renderuje aktualny HTML po prawej stronie edytora.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[520px] overflow-auto rounded-lg border bg-white p-6 text-black shadow-inner">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="en" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Temat wiadomości (EN)</CardTitle>
                <CardDescription>Temat obsługuje zmienne w formacie <code>{"{{firstName}}"}</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="email-subject-en">Subject (EN)</Label>
                <Input id="email-subject-en" value={subjectEn} onChange={(event) => setSubjectEn(event.target.value)} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="min-h-[640px]">
                <CardHeader>
                  <CardTitle>Edytor HTML (EN)</CardTitle>
                  <CardDescription>Wklej lub zmień surowy kod HTML wiadomości.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={htmlEn}
                    onChange={(event) => setHtmlEn(event.target.value)}
                    className="min-h-[520px] resize-y font-mono text-xs leading-relaxed"
                    spellCheck={false}
                  />
                </CardContent>
              </Card>

              <Card className="min-h-[640px]">
                <CardHeader>
                  <CardTitle>Podgląd na żywo (EN)</CardTitle>
                  <CardDescription>Podgląd renderuje aktualny HTML po prawej stronie edytora.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[520px] overflow-auto rounded-lg border bg-white p-6 text-black shadow-inner">
                    <div dangerouslySetInnerHTML={{ __html: previewHtmlEn }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-4 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between z-20">
          <div className="text-sm">
            {status === "saved" && <span className="text-green-600 font-bold uppercase tracking-tight">✓ Zapisano zmiany</span>}
            {status === "error" && <span className="text-destructive font-bold uppercase tracking-tight">✕ {error}</span>}
            {status === "idle" && <span className="text-neutral-400 font-medium uppercase tracking-widest text-[10px]">Czekam na zmiany...</span>}
            {status === "saving" && <span className="text-blue-600 font-bold animate-pulse uppercase tracking-tight italic">Trwa zapisywanie...</span>}
          </div>
          <Button onClick={handleSave} disabled={status === "saving" || !subject.trim() || !html.trim()} className="bg-charcoal hover:bg-black text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl">
            {status === "saving" ? "Zapisuję..." : "Zapisz szablon"}
          </Button>
        </div>
    </div>
  );
}
