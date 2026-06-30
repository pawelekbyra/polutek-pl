"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Save, Settings, RotateCcw, ArrowRight } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import Link from "next/link";

type ChannelCreator = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  bannerUrl: string | null;
  subscribersCount: number;
  displaySubscribersCount: number | null;
  user?: { imageUrl: string | null; name: string | null } | null;
};

type ChannelSettingsFormProps = {
  initialCreator: ChannelCreator | null;
  clerkFallbackImageUrl: string | null;
};

export function ChannelSettingsForm({ initialCreator, clerkFallbackImageUrl }: ChannelSettingsFormProps) {
  const [creator, setCreator] = useState(initialCreator);
  const [name, setName] = useState(initialCreator?.name || "");
  const [bio, setBio] = useState(initialCreator?.bio || "");
  const [bannerUrl, setBannerUrl] = useState(initialCreator?.bannerUrl || "");
  const [displaySubscribersCount, setDisplaySubscribersCount] = useState(initialCreator?.displaySubscribersCount?.toString() || "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, bannerUrl, displaySubscribersCount: displaySubscribersCount.trim() === "" ? null : Number(displaySubscribersCount) }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Nie udało się zapisać danych kanału.");
      }

      setCreator(payload.creator);
      setName(payload.creator.name || "");
      setBio(payload.creator.bio || "");
      setBannerUrl(payload.creator.bannerUrl || "");
      setDisplaySubscribersCount(payload.creator.displaySubscribersCount?.toString() || "");
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nie udało się zapisać danych kanału.");
      setStatus("error");
    }
  }

  if (!creator) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Kanał" />
        <Card>
          <CardHeader>
            <CardTitle>Kanał nie został znaleziony</CardTitle>
            <CardDescription>Nie udało się przygotować głównego kanału. Sprawdź konfigurację MAIN_CREATOR_SLUG albo spróbuj ponownie po odświeżeniu panelu.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const fallbackAvatar = creator.user?.imageUrl || clerkFallbackImageUrl;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Kanał" />

      <div className="mb-6 rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Ustawienia profilu</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Kanał</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Nazwa kanału, opis, cover photo i podstawowe ustawienia profilu publicznego.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Dane kanału</CardTitle>
            <CardDescription>Slug jest stały dla monokanału i pochodzi z konfiguracji, dlatego nie jest edytowany w tym formularzu.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Nazwa kanału</Label>
                <Input id="channel-name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-slug">Slug kanału</Label>
                <Input id="channel-slug" value={creator.slug} disabled className="bg-muted" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="real-subscribers">Liczba subskrybentów (licznik cache)</Label>
                    <button
                      type="button"
                      onClick={async () => {
                        setStatus("saving");
                        try {
                          const res = await fetch('/api/admin/subscribers/resync', { method: 'POST' });
                          if (res.ok) {
                            const data = await res.json();
                            const updated = data.updated.find((c: any) => c.creatorId === creator.id);
                            if (updated) {
                                setCreator({ ...creator, subscribersCount: updated.subscribersCount });
                                setStatus("saved");
                            }
                          }
                        } catch (e) {
                          setStatus("error");
                        }
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      title="Zsynchronizuj licznik cache z rzeczywistą liczbą rekordów w bazie"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  </div>
                  <Input id="real-subscribers" value={creator.subscribersCount} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-subscribers">Wyświetlana liczba subskrybentów (Fake)</Label>
                  <div className="flex gap-2">
                    <Input
                        id="display-subscribers"
                        type="number"
                        min="0"
                        value={displaySubscribersCount}
                        onChange={(event) => setDisplaySubscribersCount(event.target.value)}
                        placeholder="Puste = licznik cache"
                        className="flex-1"
                    />
                    {displaySubscribersCount !== "" && (
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 h-10 w-10"
                            onClick={() => setDisplaySubscribersCount("")}
                            title="Przywróć licznik rzeczywisty (cache)"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Jeśli wpiszesz liczbę, zostanie ona wyświetlona publicznie zamiast licznika cache.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-bio">Opis / bio</Label>
                <Textarea id="channel-bio" value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-32" maxLength={1000} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-banner">Cover photo / banner URL</Label>
                <Input id="channel-banner" value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://..." />
                <p className="text-xs text-muted-foreground">Cover photo należy do kanału i nie jest pobierane z Clerk.</p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  {status === "saved" && <span className="text-green-600">Zapisano zmiany.</span>}
                  {status === "error" && <span className="text-destructive">{error}</span>}
                  {status === "idle" && <span className="text-muted-foreground">Zmieniasz tylko publiczne, dozwolone pola kanału.</span>}
                  {status === "saving" && <span className="text-muted-foreground">Zapisywanie...</span>}
                </div>
                <Button type="submit" disabled={status === "saving" || !name.trim()}>
                  <Save className="mr-2 h-4 w-4" /> {status === "saving" ? "Zapisuję..." : "Zapisz"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Avatar</CardTitle>
              <CardDescription>Model kanału nie ma osobnego pola avatarUrl, więc publiczny avatar korzysta z bezpiecznego fallbacku użytkownika.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted">
                  {fallbackAvatar ? <Image src={fallbackAvatar} alt="Fallback avatara kanału" fill sizes="64px" className="object-cover" unoptimized /> : <ImageIcon className="h-7 w-7 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <Badge variant="outline">Fallback Clerk</Badge>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Jeśli nie ustawisz avatara kanału, zostanie użyte zdjęcie profilowe z konta właściciela kanału w Clerk.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Media globalne</CardTitle>
            </CardHeader>
            <CardContent>
                <Button variant="outline" asChild className="w-full justify-between bg-white">
                    <Link href="/admin/settings">
                        Domyślna miniatura
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
                <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
                    Ustaw obraz wyświetlany dla wszystkich filmów, które nie mają własnej miniatury.
                </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
