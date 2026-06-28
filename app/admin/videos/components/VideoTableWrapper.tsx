import { AdminVideoListItem } from "@/lib/modules/video/domain/admin-video-list.dto";
import { AdminTableSkeleton } from "@/components/skeletons/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoTable } from "./VideoTable";
import { Button } from "@/components/ui/button";

interface VideoTableWrapperProps {
    isInitialLoading: boolean;
    isRefetching: boolean;
    total: number;
    videos: AdminVideoListItem[];
    page: number;
    totalPages: number;
    onEdit: (vid: AdminVideoListItem) => void;
    onDuplicate: (vid: AdminVideoListItem) => void;
    onDelete: (id: string) => void;
    deletingVideoId?: string | null;
    onPageChange: (p: number) => void;
}

export function VideoTableWrapper({
    isInitialLoading,
    isRefetching,
    total,
    videos,
    page,
    totalPages,
    onEdit,
    onDuplicate,
    onDelete,
    deletingVideoId,
    onPageChange
}: VideoTableWrapperProps) {
    const showTableSkeleton = isInitialLoading && videos.length === 0;

    return (
        <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Zarządzaj Materiałami</CardTitle>
                    <CardDescription>Znaleziono {total} filmów.</CardDescription>
                </div>
                {isRefetching && (
                    <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground" role="status" aria-live="polite">
                        Odświeżanie listy…
                    </div>
                )}
            </CardHeader>
            <CardContent className={isRefetching ? "opacity-80 transition-opacity" : undefined}>
                {showTableSkeleton ? (
                    <AdminTableSkeleton rows={6} cols={7} />
                ) : (
                    <VideoTable
                        videos={videos}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                        deletingVideoId={deletingVideoId}
                    />
                )}

                {totalPages > 1 && !showTableSkeleton && (
                    <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1 || isRefetching}
                            onClick={() => onPageChange(page - 1)}
                        >
                            Poprzednia
                        </Button>
                        <div className="text-sm font-medium">
                            Strona <span className="text-primary">{page}</span> z {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages || isRefetching}
                            onClick={() => onPageChange(page + 1)}
                        >
                            Następna
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
