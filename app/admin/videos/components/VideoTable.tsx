"use client";

import { Video, Globe, Lock, ShieldCheck, Edit, Plus, Trash2, AlertTriangle } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { InternalVideoDTO } from "@/app/types/video";

export type AdminVideo = InternalVideoDTO & {
  showInSidebar?: boolean;
  _count?: { videoLikes: number; videoDislikes: number; comments: number };
  diagnostics?: any[];
};

interface VideoTableProps {
  videos: AdminVideo[];
  onEdit: (video: AdminVideo) => void;
  onDuplicate: (video: AdminVideo) => void;
  onDelete: (id: string) => void;
}

export function VideoTable({ videos, onEdit, onDuplicate, onDelete }: VideoTableProps) {
  return (
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
                <div className="flex items-center gap-2">
                    <div className="font-medium">{vid.title}</div>
                    {vid.diagnostics && vid.diagnostics.length > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-[10px]">{vid.diagnostics.length}</span>
                        </Badge>
                    )}
                </div>
                <div className="text-xs text-muted-foreground">/{vid.slug}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  {vid.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : vid.tier === 'LOGGED_IN' ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                  {vid.tier === 'PUBLIC' ? 'Publiczny' : vid.tier === 'LOGGED_IN' ? 'Dla zalogowanych' : 'Dla Patronów'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                L:{vid.likesCount} D:{vid.dislikesCount} V:{vid.views}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(vid)} title="Edytuj"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDuplicate(vid)} title="Kopiuj"><Plus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(vid.id)} className="text-destructive" title="Zarchiwizuj"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
