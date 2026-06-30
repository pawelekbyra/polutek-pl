"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, ImageIcon } from "@/app/components/icons";

export default function AdminSettingsPage() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings/media/default-video-thumbnail")
      .then((r) => r.json())
      .then((data) => {
        setCurrentUrl(data.url ?? null);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setIsConfirmingDelete(false);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/settings/media/default-video-thumbnail", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Wgrywanie nie powiodło się", type: "error" });
      } else {
        setCurrentUrl(data.url ?? null);
        setMessage({ text: "Domyślna miniatura została zaktualizowana.", type: "success" });
      }
    } catch {
      setMessage({ text: "Wgrywanie nie powiodło się. Spróbuj ponownie.", type: "error" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      setMessage({ text: "Kliknij ponownie Usuń, aby potwierdzić.", type: "error" });
      return;
    }

    setIsDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/media/default-video-thumbnail", { method: "DELETE" });
      if (res.ok) {
        setCurrentUrl(null);
        setIsConfirmingDelete(false);
        setMessage({ text: "Domyślna miniatura została usunięta.", type: "success" });
      } else {
        setMessage({ text: "Nie udało się usunąć miniatury.", type: "error" });
      }
    } catch {
      setMessage({ text: "Żądanie nie powiodło się. Spróbuj ponownie.", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNavigation backHref="/admin/channel" backLabel="Wróć do ustawień kanału" currentLabel="Ustawienia mediów" breadcrumbs={[{ href: "/admin/channel", label: "Kanał" }]} />

      <div className="mb-6 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Ustawienia globalne</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Media</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Konfiguracja domyślnych assetów wizualnych dla całej aplikacji.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Domyślna miniatura wideo</CardTitle>
            <CardDescription>
              Używana dla filmów, które nie mają ustawionej własnej miniatury. Zalecane: 16:9, min. 1280×720 px, JPEG/PNG/WebP, max 5 MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="w-full max-w-md aspect-video bg-muted rounded-lg animate-pulse" />
            ) : currentUrl ? (
              <div className="space-y-4">
                <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border bg-muted shadow-inner">
                  <Image
                    src={currentUrl}
                    alt="Domyślna miniatura wideo"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Zmień obraz
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isConfirmingDelete ? "Potwierdź usunięcie" : "Usuń"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Wgraj domyślną miniaturę
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleUpload}
            />

            {message && (
              <div className={`p-4 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
