import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "./utils";

export function VideoAuditLog({ logs }: { logs: any[] }) {
    return (
        <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Dziennik zdarzeń</CardTitle></CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {logs?.map((log: any) => (
                        <div key={log.id} className="p-4 rounded-xl border text-xs bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <Badge className="font-mono text-[10px] uppercase">{log.action}</Badge>
                                    <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-primary">{log.actorUserId || "SYSTEM"}</span>
                            </div>
                            {log.metadata && (
                                <pre className="mt-3 p-3 bg-black/5 rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap max-h-40 font-mono leading-relaxed">
                                    {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
                    {(!logs || logs.length === 0) && (
                        <div className="py-12 text-center text-muted-foreground italic text-sm">Brak zapisanej historii dla tego filmu.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
