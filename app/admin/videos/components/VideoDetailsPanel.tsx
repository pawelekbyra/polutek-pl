import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function VideoDetailsPanel({ video }: { video: any }) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Treść i opisy</CardTitle>
                <Button variant="outline" size="sm" asChild><Link href={`/admin/videos/${video.id}/edit`}>Edytuj w formularzu</Link></Button>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tytuł PL</Label>
                            <div className="p-3 bg-muted/50 rounded-lg font-medium">{video.title}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opis PL</Label>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm min-h-[100px] whitespace-pre-wrap leading-relaxed">{video.description || "Brak opisu."}</div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tytuł EN</Label>
                            <div className="p-3 bg-muted/50 rounded-lg font-medium">{video.titleEn || "—"}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opis EN</Label>
                            <div className="p-3 bg-muted/50 rounded-lg text-sm min-h-[100px] whitespace-pre-wrap leading-relaxed">{video.descriptionEn || "—"}</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
