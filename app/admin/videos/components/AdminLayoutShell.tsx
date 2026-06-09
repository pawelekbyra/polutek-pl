import Navbar from "@/app/components/Navbar";

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main>{children}</main>
      </div>
    );
  }

export function StatMiniCard({ label, value, color }: { label: string, value: number, color?: string }) {
    const colorClasses: any = {
        green: "text-green-600 border-green-100 bg-green-50/50",
        amber: "text-amber-600 border-amber-100 bg-amber-50/50",
        red: "text-red-600 border-red-100 bg-red-50/50",
    };
    return (
        <div className={`p-2 rounded-lg border text-center ${colorClasses[color || ''] || 'bg-muted/30'}`}>
            <p className="text-[9px] uppercase font-bold opacity-60 truncate">{label}</p>
            <p className="text-lg font-black">{value}</p>
        </div>
    );
}
