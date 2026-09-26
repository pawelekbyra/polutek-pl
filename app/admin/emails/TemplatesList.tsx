"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Copy, Trash2, Edit, AlertCircle, Mail, Shield, Loader2 } from "@/app/components/icons";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

type Template = {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  category: string;
  isSystem: boolean;
  isActive: boolean;
  subject: string;
  updatedAt: string;
};

type TemplatesListProps = {
  onEdit: (slug: string) => void;
  onNew: () => void;
};

export function TemplatesList({ onEdit, onNew }: TemplatesListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/templates");
      if (!res.ok) {
        throw new Error("Nie udało się pobrać szablonów email.");
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("API zwróciło nieprawidłową listę szablonów.");
      }

      setTemplates(data);
    } catch (fetchError) {
      setTemplates([]);
      setError(fetchError instanceof Error ? fetchError.message : "Nie udało się pobrać szablonów email.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(slug: string) {
    setTemplateToDelete(null);
    try {
      const res = await fetch(`/api/admin/templates?slug=${slug}`, { method: "DELETE" });
      if (res.ok) fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDuplicate(template: Template) {
    const newSlug = `${template.slug}-copy-${Math.floor(Math.random() * 1000)}`;
    const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...template,
            slug: newSlug,
            name: `${template.name || template.slug} (Kopia)`,
            isSystem: false
        })
    });
    if (res.ok) fetchTemplates();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" /> Pobieranie szablonów...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight">Twoje Szablony</h2>
        <Button onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" /> Nowy szablon
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="space-y-3">
              <div>
                <h3 className="font-bold tracking-tight">Nie można załadować szablonów</h3>
                <p className="text-sm">{error}</p>
              </div>
              <Button type="button" variant="outline" onClick={fetchTemplates}>
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-bold tracking-tight">Brak szablonów email</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Nie znaleziono żadnych szablonów. Dodaj pierwszy szablon ręcznie albo uruchom seed wymaganych emaili w procesie administracyjnym.
          </p>
          <Button onClick={onNew} className="mt-6">
            <Plus className="mr-2 h-4 w-4" /> Dodaj szablon
          </Button>
        </div>
      ) : (
      <div className="grid gap-3">
        {templates.map((t) => (
          <Card key={t.id} className="p-4 flex items-center justify-between group">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={t.isSystem ? "text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200" : "text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200"}>
                  {t.isSystem && <Shield className="h-3 w-3" />}
                  {t.category}
                </Badge>
                {!t.isActive && <Badge variant="secondary" className="text-[10px]">Nieaktywny</Badge>}
                <h4 className="font-bold text-sm truncate">{t.name || t.slug}</h4>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">
                Ostatnia zmiana: {format(new Date(t.updatedAt), 'PPp', { locale: pl })}
              </p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" onClick={() => onEdit(t.slug)} title="Edytuj">
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDuplicate(t)} title="Duplikuj">
                <Copy className="h-4 w-4" />
              </Button>
              {!t.isSystem && (
                <Button size="icon" variant="ghost" onClick={() => setTemplateToDelete(t)} title="Usuń" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={templateToDelete !== null} onOpenChange={(open: boolean) => { if (!open) setTemplateToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć szablon?</DialogTitle>
            <DialogDescription>
              Szablon „{templateToDelete?.name || templateToDelete?.slug}” zostanie usunięty z panelu email. Tej akcji nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Anuluj
            </DialogClose>
            <Button variant="destructive" onClick={() => { if (templateToDelete) void handleDelete(templateToDelete.slug); }}>
              Usuń szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
