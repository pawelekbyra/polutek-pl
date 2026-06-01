"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Settings, Video, Edit, Save, BarChart3, Plus, Trash2, X, Globe, Lock, ShieldCheck, Star, Clock, ImageIcon, Mail, ArrowLeft } from "@/app/components/icons";
import { formatCount, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function AdminPanel() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [videos, setVideos] = useState<any[]>([]);
  const [creator, setCreator] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'channel' | 'stats' | 'email'>('videos');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    slug: "",
    description: "",
    videoUrl: "",
    thumbnailUrl: "",
    duration: "",
    tier: "PUBLIC",
    status: "PUBLISHED",
    likesCount: 0,
    dislikesCount: 0,
    views: 0,
    isMainFeatured: false,
    sidebarOrder: 0
  });

  const [creatorForm, setCreatorForm] = useState({
    id: "",
    name: "",
    bio: "",
    slug: "",
    bannerUrl: ""
  });

  const [emailTemplate, setEmailTemplate] = useState({
    subjectPl: "",
    bodyPl: "",
    subjectEn: "",
    bodyEn: ""
  });

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;

    if (!user) {
      router.push("/");
      return;
    }

    const checkAdmin = async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      fetchAll();
    };

    checkAdmin();
  }, [user, userLoaded, authLoaded, router]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
        await Promise.all([fetchVideos(), fetchCreator(), fetchStats(), fetchEmailTemplate()]);
    } finally {
        setIsLoading(false);
    }
  }

  const fetchVideos = async () => {
    try {
      const res = await fetch("/api/admin/videos");
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error("Failed to fetch videos", err);
    }
  };

  const fetchCreator = async () => {
    try {
        const res = await fetch("/api/admin/creator");
        const data = await res.json();
        setCreator(data);
        if (data) {
            setCreatorForm({
                id: data.id,
                name: data.name || "",
                bio: data.bio || "",
                slug: data.slug || "",
                bannerUrl: data.bannerUrl || ""
            });
        }
    } catch (err) {
        console.error("Failed to fetch creator", err);
    }
  }

  const fetchStats = async () => {
      try {
          const res = await fetch("/api/admin/stats");
          const data = await res.json();
          setStats(data);
      } catch (err) {
          console.error("Failed to fetch stats", err);
      }
  }

  const fetchEmailTemplate = async () => {
    try {
      const res = await fetch("/api/admin/templates");
      const data = await res.json();
      if (data && !data.error) {
        setEmailTemplate({
          subjectPl: data.subjectPl || "",
          bodyPl: data.bodyPl || "",
          subjectEn: data.subjectEn || "",
          bodyEn: data.bodyEn || ""
        });
      }
    } catch (err) {
      console.error("Failed to fetch email template", err);
    }
  }

  const handleEdit = (vid: any) => {
    setFormData({
      id: vid.id,
      title: vid.title,
      slug: vid.slug,
      description: vid.description || "",
      videoUrl: vid.videoUrl,
      thumbnailUrl: vid.thumbnailUrl,
      duration: vid.duration || "",
      tier: vid.tier,
      status: vid.status || "PUBLISHED",
      likesCount: vid.likesCount,
      dislikesCount: vid.dislikesCount || 0,
      views: vid.views,
      isMainFeatured: vid.isMainFeatured,
      sidebarOrder: vid.sidebarOrder || 0
    });
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setFormData({
      id: "",
      title: "",
      slug: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: "",
      duration: "",
      tier: "PUBLIC",
      status: "PUBLISHED",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false,
      sidebarOrder: 0
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsEditing(false);
        fetchVideos();
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    } catch (err) {
      console.error("Submit failed", err);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure? This cannot be undone.")) return;
      try {
          const res = await fetch(`/api/admin/videos?id=${id}`, { method: 'DELETE' });
          if (res.ok) fetchVideos();
      } catch (err) {
          console.error("Delete failed", err);
      }
  }

  const handleCreatorSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await fetch("/api/admin/creator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(creatorForm)
          });
          if (res.ok) {
              alert("Channel updated successfully");
              fetchCreator();
          }
      } catch (err) {
          console.error("Creator update failed", err);
      }
  }

  const handleEmailTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailTemplate)
      });
      if (res.ok) {
        alert("Email template updated successfully");
        fetchEmailTemplate();
      }
    } catch (err) {
      console.error("Email template update failed", err);
    }
  }

  if (!isAdmin || isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Weryfikacja dostępu...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Panel Twórcy</h1>
            <p className="text-sm text-muted-foreground">Dostęp Administratora // rola ADMIN</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Powrót
              </Link>
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" /> Nowy Film
            </Button>
          </div>
        </header>

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{formData.id ? "Edytuj Film" : "Dodaj Nowy Film"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Tytuł</Label>
                    <Input id="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <Input id="slug" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Opis</Label>
                  <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">URL Wideo</Label>
                    <Input id="videoUrl" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thumbnailUrl">URL Miniaturki</Label>
                    <Input id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Czas trwania</Label>
                    <Input id="duration" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="tier">Poziom Dostępu</Label>
                    <Select value={formData.tier} onValueChange={(v) => setFormData({...formData, tier: v || "PUBLIC"})}>
                        <SelectTrigger>
                            <SelectValue placeholder="Wybierz poziom" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PUBLIC">Publiczny</SelectItem>
                            <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
                            <SelectItem value="PATRON">Patron</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status Publikacji</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v || "PUBLISHED"})}>
                        <SelectTrigger>
                            <SelectValue placeholder="Wybierz status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="PUBLISHED">Opublikowany</SelectItem>
                            <SelectItem value="UNLISTED">Niepubliczny</SelectItem>
                            <SelectItem value="ARCHIVED">Zarchiwizowany</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2 pt-4">
                       <Checkbox
                        id="isMainFeatured"
                        checked={formData.isMainFeatured}
                        onCheckedChange={(checked) => setFormData({...formData, isMainFeatured: !!checked})}
                       />
                       <Label htmlFor="isMainFeatured">Hero Video</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sidebarOrder">Kolejność (Sidebar)</Label>
                    <Input
                      id="sidebarOrder"
                      type="number"
                      value={formData.sidebarOrder}
                      onChange={e => setFormData({...formData, sidebarOrder: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="likes">Polubienia</Label>
                    <Input id="likes" type="number" value={formData.likesCount} onChange={e => setFormData({...formData, likesCount: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dislikes">Dislajki</Label>
                    <Input id="dislikes" type="number" value={formData.dislikesCount} onChange={e => setFormData({...formData, dislikesCount: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="views">Wyświetlenia</Label>
                    <Input id="views" type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Zapisz Zmiany
                </Button>
              </form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Filmy" value={stats?.totalVideos?.toString() || videos.length.toString()} icon={<Video className="h-4 w-4" />} />
          <StatCard title="Użytkownicy" value={stats?.totalUsers?.toString() || "0"} icon={<Plus className="h-4 w-4" />} />
          <StatCard
            title="Przychód (PLN)"
            value={`${stats?.revenueByCurrency?.find((r: any) => r.currency === 'PLN')?.amount?.toFixed(2) || "0.00"} PLN`}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <StatCard title="Subskrypcje" value={mounted ? (formatCount(creator?.subscribersCount || 0)) : "0"} icon={<Star className="h-4 w-4" />} />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="videos">Materiały</TabsTrigger>
                <TabsTrigger value="stats">Finanse</TabsTrigger>
                <TabsTrigger value="channel">Kanał</TabsTrigger>
                <TabsTrigger value="email">E-mail</TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-4 pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Zarządzaj Materiałami</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ekspozycja</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Tytuł</TableHead>
                                        <TableHead>Dostęp</TableHead>
                                        <TableHead>Statystyki</TableHead>
                                        <TableHead className="text-right">Akcje</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {videos.map((vid) => (
                                        <TableRow key={vid.id}>
                                            <TableCell>
                                                {vid.isMainFeatured ? (
                                                    <Badge className="bg-blue-600">Hero</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Lista</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={vid.status === 'PUBLISHED' ? 'default' : 'outline'}
                                                    className={cn(
                                                        vid.status === 'DRAFT' && "text-muted-foreground border-dashed",
                                                        vid.status === 'ARCHIVED' && "bg-red-100 text-red-700",
                                                        vid.status === 'PUBLISHED' && "bg-green-100 text-green-700 hover:bg-green-100"
                                                    )}
                                                >
                                                    {vid.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{vid.title}</div>
                                                <div className="text-xs text-muted-foreground">/{vid.slug}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="gap-1">
                                                    {vid.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : vid.tier === 'LOGGED_IN' ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                                    {vid.tier}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                L:{vid.likesCount} D:{vid.dislikesCount} V:{vid.views}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(vid)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(vid.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4 pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Historia Wpłat</CardTitle>
                        <CardDescription>Ostatnie 10 udanych transakcji Stripe.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Użytkownik</TableHead>
                                    <TableHead>Kwota</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Data</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats?.recentPayments?.map((tx: any) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="font-mono text-xs">{tx.userEmail}</TableCell>
                                        <TableCell className="font-bold">{tx.amount.toFixed(2)} {tx.currency}</TableCell>
                                        <TableCell><Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Sukces</Badge></TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {mounted ? new Date(tx.createdAt).toLocaleString('pl-PL') : ''}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="channel" className="max-w-2xl pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Tożsamość Kanału</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreatorSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="creatorName">Nazwa Twórcy</Label>
                                <Input id="creatorName" value={creatorForm.name} onChange={e => setCreatorForm({...creatorForm, name: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="channelSlug">Slug (@)</Label>
                                <Input id="channelSlug" value={creatorForm.slug} onChange={e => setCreatorForm({...creatorForm, slug: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="channelBio">Biografia</Label>
                                <Textarea id="channelBio" value={creatorForm.bio} onChange={e => setCreatorForm({...creatorForm, bio: e.target.value})} rows={4} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bannerUrl">Banner URL</Label>
                                <Input id="bannerUrl" value={creatorForm.bannerUrl} onChange={e => setCreatorForm({...creatorForm, bannerUrl: e.target.value})} />
                            </div>
                            <Button type="submit" className="w-full">Aktualizuj</Button>
                        </form>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="email" className="max-w-2xl pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>E-mail Powitalny</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleEmailTemplateSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm border-b pb-1">Wersja Polska</h3>
                                <div className="space-y-2">
                                    <Label>Temat</Label>
                                    <Input value={emailTemplate.subjectPl} onChange={e => setEmailTemplate({...emailTemplate, subjectPl: e.target.value})} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Treść (HTML)</Label>
                                    <Textarea value={emailTemplate.bodyPl} onChange={e => setEmailTemplate({...emailTemplate, bodyPl: e.target.value})} rows={6} className="font-mono text-xs" required />
                                </div>
                            </div>
                            <div className="space-y-4 pt-4">
                                <h3 className="font-semibold text-sm border-b pb-1">English Version</h3>
                                <div className="space-y-2">
                                    <Label>Subject</Label>
                                    <Input value={emailTemplate.subjectEn} onChange={e => setEmailTemplate({...emailTemplate, subjectEn: e.target.value})} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Body (HTML)</Label>
                                    <Textarea value={emailTemplate.bodyEn} onChange={e => setEmailTemplate({...emailTemplate, bodyEn: e.target.value})} rows={6} className="font-mono text-xs" required />
                                </div>
                            </div>
                            <Button type="submit" className="w-full">Zapisz Szablony</Button>
                        </form>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
