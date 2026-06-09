import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";
import { AdminLayoutShell, StatMiniCard } from "./AdminLayoutShell";
import { AdminVideosPageSkeleton } from "@/components/skeletons/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoTable } from "./VideoTable";
import { Button } from "@/components/ui/button";

interface VideoTableWrapperProps {
    isLoading: boolean;
    total: number;
    videos: AdminVideoListItem[];
    page: number;
    totalPages: number;
    onEdit: (vid: AdminVideoListItem) => void;
    onDuplicate: (vid: AdminVideoListItem) => void;
    onDelete: (id: string) => void;
    onPageChange: (p: number) => void;
}

export function VideoTableWrapper({
    isLoading,
    total,
    videos,
    page,
    totalPages,
    onEdit,
    onDuplicate,
    onDelete,
    onPageChange
}: VideoTableWrapperProps) {
    if (isLoading) return <AdminVideosPageSkeleton />;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Zarządzaj Materiałami</CardTitle>
                    <CardDescription>Znaleziono {total} filmów.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <VideoTable
                    videos={videos}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                />

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
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
                            disabled={page === totalPages}
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
