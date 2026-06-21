import { AdminLayoutShell } from "./AdminLayoutShell";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

interface AdminVideoErrorViewProps {
  error: string;
  onRetry: () => void;
}

export function AdminVideoErrorView({ error, onRetry }: AdminVideoErrorViewProps) {
  return (
    <AdminLayoutShell>
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center space-y-4 p-4">
        <div className="text-destructive font-bold text-xl">{error}</div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={onRetry}>Spróbuj ponownie</Button>
          <Button asChild><Link href="/">Wróć do strony głównej</Link></Button>
        </div>
      </div>
    </AdminLayoutShell>
  );
}
