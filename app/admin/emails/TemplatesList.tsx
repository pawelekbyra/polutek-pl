"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, AlertCircle, Mail, Shield, Loader2 } from "@/app/components/icons";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

type Template = {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  isSystem: boolean;
  isCustomized: boolean;
  subject: string;
  updatedAt: string | null;
};

type TemplatesListProps = {
  onEdit: (slug: string) => void;
  onNew: () => void;
};

/**
 * System mails always exist (their default text lives in code); an admin edit is an override that
 * "Przywróć domyślny" removes. Own templates are starting points for broadcasts.
 */
export function TemplatesList({ onEdit, onNew }: TemplatesListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

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
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/admin/templates?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      if (res.ok) fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" /> Pobieranie szablonów...
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.isSystem);
  const ownTemplates = templates.filter((t) => !t.isSystem);

  const row = (t: Template) => (
    <Card key={t.slug} className="p-4 flex items-center justify-between group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {t.isSystem && (
            <Badge
              variant="outline"
              className={t.isCustomized ? "text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200" : "text-[10px] gap-1"}
            >
              <Shield className="h-3 w-3" />
              {t.isCustomized ? "Zmieniony" : "Domyślny"}
            </Badge>
          )}
          <h4 className="font-bold text-sm truncate">{t.name || t.slug}</h4>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
        {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
        {t.updatedAt && (
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">
            Zapisano: {format(new Date(t.updatedAt), "PPp", { locale: pl })}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(t.slug)} title="Edytuj">
          <Edit className="h-4 w-4" />
        </Button>
        {(!t.isSystem || t.isCustomized) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPendingDelete(t)}
            title={t.isSystem ? "Przywróć domyślny" : "Usuń"}
            className={t.isSystem ? "" : "text-destructive"}
          >
            {t.isSystem ? "Przywróć domyślny" : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-8">
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
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Maile systemowe</h2>
              <p className="text-sm text-muted-foreground">
                Wysyła je serwis. „Domyślny” to tekst z kodu; po zapisaniu zmian wysyłana jest Twoja wersja, dopóki nie przywrócisz domyślnej.
              </p>
            </div>
            <div className="grid gap-3">{systemTemplates.map(row)}</div>
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Własne szablony</h2>
                <p className="text-sm text-muted-foreground">Punkty startowe dla rozsyłek.</p>
              </div>
              <Button onClick={onNew}>
                <Plus className="h-4 w-4 mr-2" /> Nowy szablon
              </Button>
            </div>
            {ownTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Nie masz jeszcze własnych szablonów.</p>
              </div>
            ) : (
              <div className="grid gap-3">{ownTemplates.map(row)}</div>
            )}
          </section>
        </>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(open: boolean) => { if (!open) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDelete?.isSystem ? "Przywrócić tekst domyślny?" : "Usunąć szablon?"}</DialogTitle>
            <DialogDescription>
              {pendingDelete?.isSystem
                ? `Twoja wersja maila „${pendingDelete?.name || pendingDelete?.slug}” zostanie usunięta i serwis znów będzie wysyłał tekst domyślny.`
                : `Szablon „${pendingDelete?.name || pendingDelete?.slug}” zostanie usunięty. Tej akcji nie można cofnąć.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Anuluj
            </DialogClose>
            <Button
              variant={pendingDelete?.isSystem ? "default" : "destructive"}
              onClick={() => { if (pendingDelete) void handleDelete(pendingDelete.slug); }}
            >
              {pendingDelete?.isSystem ? "Przywróć domyślny" : "Usuń szablon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
