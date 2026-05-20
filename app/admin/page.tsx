"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Settings, Video, Edit, Save, BarChart3, Plus, Trash2, X, Globe, Lock, ShieldCheck, Star, Clock, ImageIcon, Mail, ArrowLeft } from "@/app/components/icons";
import { formatCount } from "@/lib/utils";

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
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center font-serif">Weryfikacja dostępu...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1a1a1a] font-serif p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b-2 border-[#1a1a1a] pb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Panel Twórcy</h1>
            <p className="text-sm font-bold uppercase tracking-widest text-[#1a1a1a]/40 italic">Dostęp Administratora // Zweryfikowano: {adminEmail}</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="btn btn-sm rounded-none border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-all font-black uppercase tracking-widest px-6 shadow-brutalist-sm"
            >
              <ArrowLeft size={16} className="mr-2" /> Powrót do aplikacji
            </Link>
            <button
              onClick={handleCreateNew}
              className="btn btn-sm rounded-none border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-all font-black uppercase tracking-widest px-6 shadow-brutalist-sm"
            >
              <Plus size={16} className="mr-2" /> Nowy Film
            </button>
          </div>
        </header>

        {isEditing && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#1a1a1a] p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
              <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 p-2 hover:bg-[#1a1a1a]/5 rounded-full">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-black uppercase tracking-tight italic mb-8">{formData.id ? "Edytuj Film" : "Dodaj Nowy Film"}</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Tytuł</label>
                    <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-bold uppercase text-sm transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Slug (URL)</label>
                    <input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Opis</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-serif text-sm transition-all h-24" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">URL Wideo</label>
                    <input value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">URL Miniaturki</label>
                    <input value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Czas trwania (np. 12:45)</label>
                    <input value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Poziom Dostępu</label>
                    <select value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-black uppercase text-xs transition-all">
                      <option value="PUBLIC">Publiczny</option>
                      <option value="LOGGED_IN">Zalogowani</option>
                      <option value="VIP1">Patron (5 PLN+)</option>
                      <option value="VIP2">Sponsor (10 PLN+)</option>
                    </select>
                  </div>
                  <div className="space-y-1 flex items-center gap-3 pt-6">
                       <input
                        type="checkbox"
                        checked={formData.isMainFeatured}
                        onChange={e => setFormData({...formData, isMainFeatured: e.target.checked})}
                        className="w-5 h-5 accent-[#1a1a1a]"
                       />
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]">Hero Video</label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Polubienia</label>
                    <input type="number" value={formData.likesCount} onChange={e => setFormData({...formData, likesCount: parseInt(e.target.value) || 0})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Dislajki</label>
                    <input type="number" value={formData.dislikesCount} onChange={e => setFormData({...formData, dislikesCount: parseInt(e.target.value) || 0})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Wyświetlenia</label>
                    <input type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-3 font-mono text-sm transition-all" />
                  </div>
                </div>

                <button type="submit" className="btn btn-block bg-[#1a1a1a] text-white hover:bg-primary border-none rounded-none h-14 font-black uppercase tracking-[0.2em] shadow-brutalist">
                  Zapisz Zmiany
                </button>
              </form>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Wszystkie Filmy" value={stats?.totalVideos?.toString() || videos.length.toString()} icon={<Video size={20} />} />
          <StatCard title="Użytkownicy" value={stats?.totalUsers?.toString() || "0"} icon={<Plus size={20} />} />
          <StatCard title="Przychód" value={`${stats?.totalRevenue?.toFixed(2) || "0.00"} PLN`} icon={<BarChart3 size={20} />} />
          <StatCard title="Subskrypcje" value={mounted ? (formatCount(creator?.subscribersCount || 0)) : "0"} icon={<Star size={20} />} />
        </section>

        <div className="flex border-b-2 border-[#1a1a1a]/10">
            <button
                onClick={() => setActiveTab('videos')}
                className={`px-8 py-4 font-black uppercase tracking-widest text-sm transition-all border-b-2 -mb-[2px] ${activeTab === 'videos' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-[#1a1a1a]/30 hover:text-[#1a1a1a]'}`}
            >
                Materiały
            </button>
            <button
                onClick={() => setActiveTab('stats')}
                className={`px-8 py-4 font-black uppercase tracking-widest text-sm transition-all border-b-2 -mb-[2px] ${activeTab === 'stats' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-[#1a1a1a]/30 hover:text-[#1a1a1a]'}`}
            >
                Finanse
            </button>
            <button
                onClick={() => setActiveTab('channel')}
                className={`px-8 py-4 font-black uppercase tracking-widest text-sm transition-all border-b-2 -mb-[2px] ${activeTab === 'channel' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-[#1a1a1a]/30 hover:text-[#1a1a1a]'}`}
            >
                Ustawienia Kanału
            </button>
            <button
                onClick={() => setActiveTab('email')}
                className={`px-8 py-4 font-black uppercase tracking-widest text-sm transition-all border-b-2 -mb-[2px] ${activeTab === 'email' ? 'border-[#1a1a1a] text-[#1a1a1a]' : 'border-transparent text-[#1a1a1a]/30 hover:text-[#1a1a1a]'}`}
            >
                E-mail
            </button>
        </div>

        {activeTab === 'videos' ? (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Zarządzaj Materiałami</h2>
            </div>
            <div className="bg-white border-2 border-[#1a1a1a] shadow-brutalist overflow-hidden">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a1a1a] text-white uppercase text-[10px] font-black tracking-widest">
                  <th className="p-4">Status</th>
                  <th className="p-4">Tytuł</th>
                  <th className="p-4">Dostęp</th>
                  <th className="p-4">Statystyki</th>
                  <th className="p-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]/10">
                {videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-[#1a1a1a]/5 transition-colors group">
                    <td className="p-4">
                       {vid.isMainFeatured ? (
                         <span className="bg-primary text-white text-[8px] font-black uppercase px-2 py-1 rounded">Hero</span>
                       ) : (
                         <span className="bg-[#1a1a1a]/10 text-[#1a1a1a]/40 text-[8px] font-black uppercase px-2 py-1 rounded">Lista</span>
                       )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm uppercase tracking-tight">{vid.title}</div>
                      <div className="text-[10px] text-[#1a1a1a]/40 font-mono">/{vid.slug}</div>
                    </td>
                    <td className="p-4">
                       <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 flex items-center gap-1 w-fit ${
                         vid.tier === 'VIP2' ? 'border-yellow-500 text-yellow-600' :
                         vid.tier === 'VIP1' ? 'border-blue-500 text-blue-600' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/40'
                       }`}>
                         {vid.tier === 'PUBLIC' ? <Globe size={10} /> : vid.tier === 'LOGGED_IN' ? <Lock size={10} /> : <ShieldCheck size={10} />}
                         {vid.tier}
                       </span>
                    </td>
                    <td className="p-4 font-mono text-[10px] space-x-3">
                       <span className="text-[#1a1a1a]/60">L: {vid.likesCount}</span>
                       <span className="text-[#1a1a1a]/60">D: {vid.dislikesCount}</span>
                       <span className="text-[#1a1a1a]/60">V: {vid.views}</span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                       <button onClick={() => handleEdit(vid)} className="p-2 hover:bg-[#1a1a1a] hover:text-white transition-colors border border-transparent hover:border-[#1a1a1a]"><Edit size={16} /></button>
                       <button onClick={() => handleDelete(vid.id)} className="p-2 hover:bg-error hover:text-white transition-colors border border-transparent hover:border-error"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        ) : activeTab === 'stats' ? (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase tracking-tight italic">Historia Wpłat</h2>
                    <p className="text-xs text-[#1a1a1a]/40 font-bold uppercase">Ostatnie 10 udanych transakcji w systemie Stripe.</p>
                </div>

                <div className="bg-white border-2 border-[#1a1a1a] shadow-brutalist overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1a1a1a] text-white uppercase text-[10px] font-black tracking-widest">
                                <th className="p-4">Użytkownik</th>
                                <th className="p-4">Kwota</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1a]/10">
                            {stats?.recentTransactions?.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-[#1a1a1a]/5 transition-colors">
                                    <td className="p-4 font-mono text-xs">{tx.user?.email}</td>
                                    <td className="p-4 font-black">{tx.amount.toFixed(2)} {tx.currency}</td>
                                    <td className="p-4">
                                        <span className="bg-success/10 text-success text-[8px] font-black uppercase px-2 py-1 rounded">Zakończono</span>
                                    </td>
                                    <td className="p-4 text-right font-mono text-[10px] text-[#1a1a1a]/40">
                                        {mounted ? new Date(tx.createdAt).toLocaleString('pl-PL') : ''}
                                    </td>
                                </tr>
                            ))}
                            {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-[#1a1a1a]/20 font-black uppercase italic">Brak zarejestrowanych wpłat</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        ) : activeTab === 'channel' ? (
          <section className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Tożsamość Kanału</h2>
                <p className="text-xs text-[#1a1a1a]/40 font-bold uppercase">Aktualizuj dane widoczne dla Twoich widzów.</p>
             </div>

             <form onSubmit={handleCreatorSubmit} className="space-y-6 bg-white border-2 border-[#1a1a1a] p-8 shadow-brutalist">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Nazwa Twórcy</label>
                    <input
                        value={creatorForm.name}
                        onChange={e => setCreatorForm({...creatorForm, name: e.target.value})}
                        placeholder="np. POLUTEK.COM"
                        className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-black uppercase text-lg transition-all"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Slug Kanału (polutek.com/@slug)</label>
                    <input
                        value={creatorForm.slug}
                        onChange={e => setCreatorForm({...creatorForm, slug: e.target.value})}
                        placeholder="np. polutek"
                        className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-mono text-sm transition-all"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Biografia Kanału</label>
                    <textarea
                        value={creatorForm.bio}
                        onChange={e => setCreatorForm({...creatorForm, bio: e.target.value})}
                        placeholder="Napisz coś o swoim kanale..."
                        className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-serif text-base transition-all h-32 leading-relaxed"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">URL Bannera Kanału</label>
                    <input
                        value={creatorForm.bannerUrl}
                        onChange={e => setCreatorForm({...creatorForm, bannerUrl: e.target.value})}
                        placeholder="https://..."
                        className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-mono text-sm transition-all"
                    />
                </div>

                <button type="submit" className="btn btn-block bg-[#1a1a1a] text-white hover:bg-primary border-none rounded-none h-14 font-black uppercase tracking-[0.2em] shadow-brutalist transition-all active:translate-x-1 active:translate-y-1 active:shadow-none">
                    Aktualizuj Ustawienia Kanału
                </button>
             </form>
          </section>
        ) : (
          <section className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight italic">E-mail Powitalny</h2>
              <p className="text-xs text-[#1a1a1a]/40 font-bold uppercase">Edytuj wiadomość, którą otrzymują nowi użytkownicy.</p>
            </div>

            <form onSubmit={handleEmailTemplateSubmit} className="space-y-8 bg-white border-2 border-[#1a1a1a] p-8 shadow-brutalist">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase border-b border-[#1a1a1a]/10 pb-2">Wersja Polska</h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Temat</label>
                  <input
                    value={emailTemplate.subjectPl}
                    onChange={e => setEmailTemplate({...emailTemplate, subjectPl: e.target.value})}
                    placeholder="np. Witaj w POLUTEK.COM!"
                    className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-bold text-sm transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Treść (HTML)</label>
                  <textarea
                    value={emailTemplate.bodyPl}
                    onChange={e => setEmailTemplate({...emailTemplate, bodyPl: e.target.value})}
                    className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-mono text-xs transition-all h-40 leading-relaxed"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-black uppercase border-b border-[#1a1a1a]/10 pb-2">English Version</h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Subject</label>
                  <input
                    value={emailTemplate.subjectEn}
                    onChange={e => setEmailTemplate({...emailTemplate, subjectEn: e.target.value})}
                    placeholder="e.g. Welcome to POLUTEK.COM!"
                    className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-bold text-sm transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/40">Body (HTML)</label>
                  <textarea
                    value={emailTemplate.bodyEn}
                    onChange={e => setEmailTemplate({...emailTemplate, bodyEn: e.target.value})}
                    className="w-full bg-[#1a1a1a]/5 border-2 border-transparent focus:border-[#1a1a1a] outline-none p-4 font-mono text-xs transition-all h-40 leading-relaxed"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-block bg-[#1a1a1a] text-white hover:bg-primary border-none rounded-none h-14 font-black uppercase tracking-[0.2em] shadow-brutalist transition-all">
                Aktualizuj Szablony E-mail
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-[#1a1a1a] p-6 shadow-brutalist hover:-translate-y-1 transition-transform">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-[#1a1a1a] text-white">{icon}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/30">Live Data</div>
      </div>
      <div className="text-3xl font-black italic mb-1">{value}</div>
      <div className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/60">{title}</div>
    </div>
  );
}
