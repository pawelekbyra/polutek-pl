"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EmailTemplateEditorProps = {
  initialTemplate: {
    slug: string;
    subject: string;
    html: string;
  };
};

export function EmailTemplateEditor({ initialTemplate }: EmailTemplateEditorProps) {
  const [slug] = useState(initialTemplate.slug);
  const [subject, setSubject] = useState(initialTemplate.subject);
  const [html, setHtml] = useState(initialTemplate.html);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(() => {
    return html.replaceAll("{{firstName}}", "Jan");
  }, [html]);

  async function handleSave() {
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, subject, html }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Nie udało się zapisać szablonu.");
      }

      const saved = await response.json();
      setSubject(saved.subject);
      setHtml(saved.html);
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać szablonu.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Panel admina</p>
            <h1 className="text-3xl font-bold tracking-tight">Szablony e-mail</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Edytujesz szablon <code className="rounded bg-muted px-1 py-0.5">{slug}</code>. Zmienna <code className="rounded bg-muted px-1 py-0.5">{"{{firstName}}"}</code> zostanie podmieniona podczas wysyłki.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin">Powrót do panelu</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Temat wiadomości</CardTitle>
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
              <CardTitle>Edytor HTML</CardTitle>
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
              <CardTitle>Podgląd na żywo</CardTitle>
              <CardDescription>Podgląd renderuje aktualny HTML po prawej stronie edytora.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[520px] overflow-auto rounded-lg border bg-white p-6 text-black shadow-inner">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="sticky bottom-4 flex flex-col gap-3 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            {status === "saved" && <span className="text-green-600">Zapisano zmiany w bazie danych.</span>}
            {status === "error" && <span className="text-destructive">{error}</span>}
            {status === "idle" && <span className="text-muted-foreground">Zmiany zostaną zapisane dla slugu {slug}.</span>}
            {status === "saving" && <span className="text-muted-foreground">Zapisywanie...</span>}
          </div>
          <Button onClick={handleSave} disabled={status === "saving" || !subject.trim() || !html.trim()}>
            {status === "saving" ? "Zapisuję..." : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </main>
  );
}
