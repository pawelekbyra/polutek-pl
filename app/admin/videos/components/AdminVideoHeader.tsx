import Link from 'next/link';
import { Plus } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { Button } from "@/components/ui/button";

interface AdminVideoHeaderProps {
  onCreateNew: () => void;
}

export function AdminVideoHeader({ onCreateNew }: AdminVideoHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4">
      <div className="space-y-3">
        <AdminNavigation backHref="/admin" backLabel="Wróć do panelu admina" currentLabel="Filmy" />
        <div className="space-y-1">
        <h1 className="text-4xl font-bold tracking-tight">Filmy</h1>
        <p className="text-sm text-muted-foreground">Dodawanie, edycja, status publikacji, miniatury i dostęp.</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" asChild><Link href="/admin/videos/layout">Układ kanału</Link></Button>
        <Button onClick={onCreateNew}><Plus className="mr-2 h-4 w-4" /> Nowy film</Button>
      </div>
    </header>
  );
}
