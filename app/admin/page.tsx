"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Settings, Video, Edit, Save, BarChart3, Plus, Trash2, X, Globe, Lock, ShieldCheck, Star, Clock, ImageIcon, Mail, ArrowLeft } from "@/app/components/icons";
import { formatCount } from "@/lib/utils";
import { Button, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, Modal, ModalHeader, ModalBody, Label, TextInput, Textarea, Select, Checkbox, Card } from "flowbite-react";

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
    likesCount: 0,
    dislikesCount: 0,
    views: 0,
    isMainFeatured: false
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

  const adminEmail = "pawel.perfect@gmail.com";

  useEffect(() => {
    if (userLoaded && authLoaded) {
      if (user?.primaryEmailAddress?.emailAddress !== adminEmail) {
        router.push("/");
      } else {
        setIsAdmin(true);
        fetchAll();
      }
    }
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
    setIsEditing(true);
    setFormData({
      id: vid.id,
      title: vid.title,
      slug: vid.slug,
      description: vid.description || "",
      videoUrl: vid.videoUrl,
      thumbnailUrl: vid.thumbnailUrl,
      duration: vid.duration || "",
      tier: vid.tier,
      likesCount: vid.likesCount,
      dislikesCount: vid.dislikesCount || 0,
      views: vid.views,
      isMainFeatured: vid.isMainFeatured
    });
  };

  const handleCreateNew = () => {
    setIsEditing(true);
    setFormData({
      id: "",
      title: "",
      slug: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: "",
      duration: "",
      tier: "PUBLIC",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false
    });
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
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Weryfikacja dostępu...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b border-gray-200 pb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Panel Twórcy</h1>
            <p className="text-sm text-gray-500">Dostęp Administratora // Zweryfikowano: {adminEmail}</p>
          </div>
          <div className="flex gap-4">
            <Button color="light" as={Link} href="/">
              <ArrowLeft size={16} className="mr-2" /> Powrót do aplikacji
            </Button>
            <Button color="blue" onClick={handleCreateNew}>
              <Plus size={16} className="mr-2" /> Nowy Film
            </Button>
          </div>
        </header>

        <Modal show={isEditing} onClose={() => setIsEditing(false)} size="2xl">
          <ModalHeader>{formData.id ? "Edytuj Film" : "Dodaj Nowy Film"}</ModalHeader>
          <ModalBody>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label htmlFor="title">Tytuł</Label>
                    <TextInput id="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <TextInput id="slug" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} required />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description">Opis</Label>
                  <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <Label htmlFor="videoUrl">URL Wideo</Label>
                    <TextInput id="videoUrl" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="thumbnailUrl">URL Miniaturki</Label>
                    <TextInput id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="duration">Czas trwania (np. 12:45)</Label>
                    <TextInput id="duration" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1">
                    <Label htmlFor="tier">Poziom Dostępu</Label>
                    <Select id="tier" value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})}>
                      <option value="PUBLIC">Publiczny</option>
                      <option value="LOGGED_IN">Zalogowani</option>
                      <option value="VIP1">Patron (5 PLN+)</option>
                      <option value="VIP2">Sponsor (10 PLN+)</option>
                    </Select>
                  </div>
                  <div className="space-y-1 flex items-center gap-3 pt-6">
                       <Checkbox
                        id="isMainFeatured"
                        checked={formData.isMainFeatured}
                        onChange={e => setFormData({...formData, isMainFeatured: e.target.checked})}
                       />
                       <Label htmlFor="isMainFeatured">Hero Video</Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <Label htmlFor="likes">Polubienia</Label>
                    <TextInput id="likes" type="number" value={formData.likesCount} onChange={e => setFormData({...formData, likesCount: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dislikes">Dislajki</Label>
                    <TextInput id="dislikes" type="number" value={formData.dislikesCount} onChange={e => setFormData({...formData, dislikesCount: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="views">Wyświetlenia</Label>
                    <TextInput id="views" type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} />
                  </div>
                </div>

                <Button type="submit" color="blue" fullSized size="xl">
                  Zapisz Zmiany
                </Button>
              </form>
          </ModalBody>
        </Modal>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Wszystkie Filmy" value={stats?.totalVideos?.toString() || videos.length.toString()} icon={<Video size={20} />} />
          <StatCard title="Użytkownicy" value={stats?.totalUsers?.toString() || "0"} icon={<Plus size={20} />} />
          <StatCard title="Przychód" value={`${stats?.totalRevenue?.toFixed(2) || "0.00"} PLN`} icon={<BarChart3 size={20} />} />
          <StatCard title="Subskrypcje" value={mounted ? (formatCount(creator?.subscribersCount || 0)) : "0"} icon={<Star size={20} />} />
        </section>

        <div className="border-b border-gray-200">
          <div className="flex space-x-8">
            {[
              { id: 'videos', label: 'Materiały' },
              { id: 'stats', label: 'Finanse' },
              { id: 'channel', label: 'Ustawienia Kanału' },
              { id: 'email', label: 'E-mail' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'videos' ? (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Zarządzaj Materiałami</h2>
            </div>
            <div className="overflow-x-auto">
              <Table hoverable>
                <TableHead>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Tytuł</TableHeadCell>
                  <TableHeadCell>Dostęp</TableHeadCell>
                  <TableHeadCell>Statystyki</TableHeadCell>
                  <TableHeadCell className="text-right">Akcje</TableHeadCell>
                </TableHead>
                <TableBody className="divide-y">
                  {videos.map((vid) => (
                    <TableRow key={vid.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <TableCell>
                        {vid.isMainFeatured ? (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">Hero</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">Lista</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-gray-900">{vid.title}</div>
                        <div className="text-xs text-gray-500">/{vid.slug}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded border ${
                          vid.tier === 'VIP2' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          vid.tier === 'VIP1' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {vid.tier === 'PUBLIC' ? <Globe size={10} /> : vid.tier === 'LOGGED_IN' ? <Lock size={10} /> : <ShieldCheck size={10} />}
                          {vid.tier}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 space-x-3">
                        <span>L: {vid.likesCount}</span>
                        <span>D: {vid.dislikesCount}</span>
                        <span>V: {vid.views}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button color="light" size="xs" onClick={() => handleEdit(vid)}><Edit size={16} /></Button>
                          <Button color="failure" size="xs" onClick={() => handleDelete(vid.id)}><Trash2 size={16} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : activeTab === 'stats' ? (
            <section className="space-y-8">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold">Historia Wpłat</h2>
                    <p className="text-xs text-gray-500">Ostatnie 10 udanych transakcji w systemie Stripe.</p>
                </div>

                <div className="overflow-x-auto">
                    <Table hoverable>
                        <TableHead>
                            <TableHeadCell>Użytkownik</TableHeadCell>
                            <TableHeadCell>Kwota</TableHeadCell>
                            <TableHeadCell>Status</TableHeadCell>
                            <TableHeadCell className="text-right">Data</TableHeadCell>
                        </TableHead>
                        <TableBody className="divide-y text-gray-900">
                            {stats?.recentTransactions?.map((tx: any) => (
                                <TableRow key={tx.id} className="bg-white">
                                    <TableCell className="font-mono text-xs">{tx.user?.email}</TableCell>
                                    <TableCell className="font-bold">{tx.amount.toFixed(2)} {tx.currency}</TableCell>
                                    <TableCell>
                                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">Zakończono</span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-gray-500">
                                        {mounted ? new Date(tx.createdAt).toLocaleString('pl-PL') : ''}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={4} className="p-12 text-center text-gray-400">Brak zarejestrowanych wpłat</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
        ) : activeTab === 'channel' ? (
          <section className="max-w-2xl space-y-8">
             <div className="space-y-1">
                <h2 className="text-2xl font-bold">Tożsamość Kanału</h2>
                <p className="text-xs text-gray-500">Aktualizuj dane widoczne dla Twoich widzów.</p>
             </div>

             <Card>
               <form onSubmit={handleCreatorSubmit} className="space-y-6">
                  <div className="space-y-1">
                      <Label htmlFor="creatorName">Nazwa Twórcy</Label>
                      <TextInput
                          id="creatorName"
                          value={creatorForm.name}
                          onChange={e => setCreatorForm({...creatorForm, name: e.target.value})}
                          placeholder="np. POLUTEK.PL"
                          required
                      />
                  </div>

                  <div className="space-y-1">
                      <Label htmlFor="channelSlug">Slug Kanału (polutek.pl/@slug)</Label>
                      <TextInput
                          id="channelSlug"
                          value={creatorForm.slug}
                          onChange={e => setCreatorForm({...creatorForm, slug: e.target.value})}
                          placeholder="np. polutek"
                          required
                      />
                  </div>

                  <div className="space-y-1">
                      <Label htmlFor="channelBio">Biografia Kanału</Label>
                      <Textarea
                          id="channelBio"
                          value={creatorForm.bio}
                          onChange={e => setCreatorForm({...creatorForm, bio: e.target.value})}
                          placeholder="Napisz coś o swoim kanale..."
                          rows={4}
                      />
                  </div>

                  <div className="space-y-1">
                      <Label htmlFor="bannerUrl">URL Bannera Kanału</Label>
                      <TextInput
                          id="bannerUrl"
                          value={creatorForm.bannerUrl}
                          onChange={e => setCreatorForm({...creatorForm, bannerUrl: e.target.value})}
                          placeholder="https://..."
                      />
                  </div>

                  <Button type="submit" color="blue" fullSized size="xl">
                      Aktualizuj Ustawienia Kanału
                  </Button>
               </form>
             </Card>
          </section>
        ) : (
          <section className="max-w-2xl space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">E-mail Powitalny</h2>
              <p className="text-xs text-gray-500">Edytuj wiadomość, którą otrzymują nowi użytkownicy.</p>
            </div>

            <Card>
              <form onSubmit={handleEmailTemplateSubmit} className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-2">Wersja Polska</h3>
                  <div className="space-y-1">
                    <Label htmlFor="subjectPl">Temat</Label>
                    <TextInput
                      id="subjectPl"
                      value={emailTemplate.subjectPl}
                      onChange={e => setEmailTemplate({...emailTemplate, subjectPl: e.target.value})}
                      placeholder="np. Witaj w POLUTEK.PL!"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bodyPl">Treść (HTML)</Label>
                    <Textarea
                      id="bodyPl"
                      value={emailTemplate.bodyPl}
                      onChange={e => setEmailTemplate({...emailTemplate, bodyPl: e.target.value})}
                      rows={6}
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold border-b pb-2">English Version</h3>
                  <div className="space-y-1">
                    <Label htmlFor="subjectEn">Subject</Label>
                    <TextInput
                      id="subjectEn"
                      value={emailTemplate.subjectEn}
                      onChange={e => setEmailTemplate({...emailTemplate, subjectEn: e.target.value})}
                      placeholder="e.g. Welcome to POLUTEK.PL!"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bodyEn">Body (HTML)</Label>
                    <Textarea
                      id="bodyEn"
                      value={emailTemplate.bodyEn}
                      onChange={e => setEmailTemplate({...emailTemplate, bodyEn: e.target.value})}
                      rows={6}
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" color="blue" fullSized size="xl">
                  Aktualizuj Szablony E-mail
                </Button>
              </form>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">{icon}</div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Data</div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">{title}</div>
      </div>
    </Card>
  );
}
