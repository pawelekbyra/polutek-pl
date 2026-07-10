"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/app/hooks/useToast";

type Template = {
  kind: string;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  isCustomized: boolean;
  updatedAt: string | null;
};

const KIND_LABELS: Record<string, string> = {
  WELCOME: "Powitanie (nowe konto)",
  PATRON: "Przyznanie statusu Patrona",
  COMMENT: "Polubienie komentarza",
  SYSTEM: "Wiadomość systemowa",
  SUPPORT: "Wsparcie",
};

export function NotificationTemplatesEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingKind, setEditingKind] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/notifications/templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  function startEdit(t: Template) {
    setEditingKind(t.kind);
    setDraft({ ...t });
  }

  async function save() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/notifications/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        toast("Zapisano szablon.", "success");
        setEditingKind(null);
        setDraft(null);
        fetchTemplates();
      } else {
        toast("Błąd zapisu szablonu.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function resetToDefault(kind: string) {
    const res = await fetch(`/api/admin/notifications/templates?kind=${kind}`, { method: "DELETE" });
    if (res.ok) {
      toast("Przywrócono domyślną treść.", "success");
      fetchTemplates();
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-neutral-100 rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Szablony powiadomień</h2>
        <p className="text-sm text-gray-600 mt-1">
          Domyślna treść standardowych powiadomień. Nadpisz PL/EN dla dowolnego typu.
        </p>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.kind} className="bg-white border border-neutral-200 rounded-xl p-4">
            {editingKind === t.kind && draft ? (
              <div className="space-y-4">
                <h4 className="font-bold text-sm">{KIND_LABELS[t.kind] || t.kind}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-neutral-500">Tytuł (PL)</label>
                    <Input value={draft.titlePl} onChange={(e) => setDraft({ ...draft, titlePl: e.target.value })} />
                    <label className="text-xs font-bold uppercase text-neutral-500">Treść (PL)</label>
                    <Textarea value={draft.bodyPl} onChange={(e) => setDraft({ ...draft, bodyPl: e.target.value })} className="min-h-[100px]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-neutral-500">Title (EN)</label>
                    <Input value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} />
                    <label className="text-xs font-bold uppercase text-neutral-500">Body (EN)</label>
                    <Textarea value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} className="min-h-[100px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setEditingKind(null); setDraft(null); }}>
                    Anuluj
                  </Button>
                  <Button onClick={save} disabled={isSaving}>
                    {isSaving ? "Zapisywanie…" : "Zapisz"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-sm">{KIND_LABELS[t.kind] || t.kind}</h4>
                    {t.isCustomized && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Zmodyfikowany
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 truncate">{t.titlePl}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.isCustomized && (
                    <Button size="sm" variant="ghost" onClick={() => resetToDefault(t.kind)}>
                      Przywróć domyślne
                    </Button>
                  )}
                  <Button size="sm" onClick={() => startEdit(t)}>
                    Edytuj
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
