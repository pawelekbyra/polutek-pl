"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Trash2, Edit, Check, X, Shield, Mail } from "@/app/components/icons";
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Czy na pewno chcesz usunąć ten szablon?")) return;
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

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 bg-neutral-100 rounded-xl" /><div className="h-12 bg-neutral-100 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tight">Twoje Szablony</h2>
        <Button onClick={onNew} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
          <Plus className="w-4 h-4 mr-2" /> Nowy szablon
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border border-neutral-200 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:border-neutral-900 transition-all">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    t.isSystem ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                )}>
                  {t.isSystem ? <Shield className="w-3 h-3 inline mr-1" /> : null}
                  {t.category}
                </span>
                {!t.isActive && <span className="bg-neutral-100 text-neutral-500 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-neutral-200">Nieaktywny</span>}
                <h4 className="font-bold text-sm text-neutral-900 truncate">{t.name || t.slug}</h4>
              </div>
              <p className="text-xs text-neutral-500 line-clamp-1">{t.subject}</p>
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-widest mt-1">
                Ostatnia zmiana: {format(new Date(t.updatedAt), 'PPp', { locale: pl })}
              </p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" onClick={() => onEdit(t.slug)} title="Edytuj">
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDuplicate(t)} title="Duplikuj">
                <Copy className="w-4 h-4" />
              </Button>
              {!t.isSystem && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(t.slug)} title="Usuń" className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
