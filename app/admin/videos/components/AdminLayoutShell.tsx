import Navbar from "@/app/components/Navbar";

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main>{children}</main>
      </div>
    );
  }
