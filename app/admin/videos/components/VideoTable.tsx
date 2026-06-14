"use client";

import { Video, Globe, Lock, ShieldCheck, Edit, Plus, Trash2, AlertTriangle, Eye, ExternalLink as LinkIcon, FileVideo } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";

interface VideoTableProps {
  videos: AdminVideoListItem[];
  onEdit: (video: AdminVideoListItem) => void;
  onDuplicate: (video: AdminVideoListItem) => void;
  onDelete: (id: string) => void;
}

export function VideoTable({ videos, onEdit, onDuplicate, onDelete }: VideoTableProps) {
  const copyLink = (slug: string) => {
      const url = `${window.location.origin}/watch/${slug}`;
      navigator.clipboard.writeText(url);
      alert("Link skopiowany do schowka.");
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Miniatury</TableHead>
            <TableHead>Ekspozycja</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tytuł & Slug</TableHead>
            <TableHead>Dostęp & Źródło</TableHead>
            <TableHead>Statystyki</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((vid) => (
            <TableRow key={vid.id}>
              <TableCell>
                  <div className="relative w-16 aspect-video bg-muted rounded overflow-hidden">
                      {vid.thumbnailUrl ? (
                          <Image src={vid.thumbnailUrl} alt={vid.title} fill className="object-cover" />
                      ) : (
                          <div className="flex items-center justify-center h-full"><FileVideo className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                  </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                    {vid.isMainFeatured && <Badge className="bg-blue-600 w-fit">Hero</Badge>}
                    {vid.showInSidebar ? (
                        <Badge variant="outline" className="w-fit text-[10px]">Sidebar #{vid.sidebarOrder}</Badge>
                    ) : (
                        <Badge variant="secondary" className="w-fit text-[10px] opacity-50">Ukryty</Badge>
                    )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={vid.status === 'PUBLISHED' ? 'default' : 'outline'}
                  className={cn(
                    vid.status === 'DRAFT' && "text-muted-foreground border-dashed",
                    vid.status === 'ARCHIVED' && "bg-red-100 text-red-700",
                    vid.status === 'PUBLISHED' && "bg-green-100 text-green-700 hover:bg-green-100",
                    vid.status === 'UNLISTED' && "bg-amber-100 text-amber-700"
                  )}
                >
                  {vid.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <Link href={`/admin/videos/${vid.id}`} className="font-medium hover:underline decoration-primary underline-offset-4">{vid.title}</Link>
                        {vid.diagnosticsIssuesCount > 0 && (
                            <Badge variant="destructive" title="Wymaga uwagi" className="h-5 px-1.5 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span className="text-[10px]">{vid.diagnosticsIssuesCount}</span>
                            </Badge>
                        )}
                    </div>
                    {vid.titleEn && <div className="text-xs text-muted-foreground italic">{vid.titleEn}</div>}
                    <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-70">/{vid.slug}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="gap-1 w-fit text-[10px]">
                    {vid.tier === 'PUBLIC' ? <Globe className="h-2.5 w-2.5" /> : vid.tier === 'LOGGED_IN' ? <Lock className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                    {vid.tier === 'PUBLIC' ? 'Publiczny' : vid.tier === 'LOGGED_IN' ? 'Zalogowani' : 'Patroni'}
                    </Badge>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="text-[10px] uppercase text-muted-foreground font-semibold">{vid.provider || vid.sourceKind}</div>
                        {vid.migrationStatus !== 'READY' && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[9px] h-4 px-1 w-fit",
                                    vid.migrationStatus === 'MIGRATION_REQUIRED' && "border-amber-500 text-amber-600 bg-amber-50",
                                    vid.migrationStatus === 'MISSING_SOURCE' && "border-red-500 text-red-600 bg-red-50",
                                    vid.migrationStatus === 'FAILED' && "border-red-700 text-red-700 bg-red-100",
                                    vid.migrationStatus === 'PROCESSING' && "border-blue-500 text-blue-600 bg-blue-50 animate-pulse"
                                )}
                            >
                                {vid.migrationStatus === 'MIGRATION_REQUIRED' ? 'MIGRACJA' :
                                 vid.migrationStatus === 'MISSING_SOURCE' ? 'BRAK' :
                                 vid.migrationStatus}
                            </Badge>
                        )}
                    </div>
                </div>
              </TableCell>
              <TableCell className="text-[10px] text-muted-foreground leading-relaxed">
                <div>👁 {vid.views.toLocaleString()}</div>
                <div>👍 {vid.likesCount} / 👎 {vid.dislikesCount}</div>
                <div>💬 {vid.commentsCount}</div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(vid)} title="Edytuj"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" asChild title="Podgląd"><Link href={`/watch/${vid.slug}`} target="_blank"><Eye className="h-4 w-4" /></Link></Button>
                  <Button variant="ghost" size="icon" onClick={() => copyLink(vid.slug)} title="Kopiuj link"><LinkIcon className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDuplicate(vid as
any)} title="Duplikuj"><Plus className="h-4 w-4" /></Button>
                  {vid.status !== 'ARCHIVED' && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(vid.id)} className="text-destructive" title="Zarchiwizuj"><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {videos.length === 0 && (
              <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">Brak filmów spełniających kryteria.</TableCell>
              </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
