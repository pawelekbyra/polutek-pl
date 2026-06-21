import { StatMiniCard } from "./AdminLayoutShell";

interface AdminVideoStatsProps {
  stats: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    public: number;
    loggedIn: number;
    patron: number;
  };
}

export function AdminVideoStats({ stats }: AdminVideoStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      <StatMiniCard label="Wszystkie" value={stats.total} />
      <StatMiniCard label="Publikacje" value={stats.published} color="green" />
      <StatMiniCard label="Szkice" value={stats.drafts} color="amber" />
      <StatMiniCard label="Archiv" value={stats.archived} color="red" />
      <StatMiniCard label="Public" value={stats.public} />
      <StatMiniCard label="Login" value={stats.loggedIn} />
      <StatMiniCard label="Patron" value={stats.patron} color="amber" />
    </div>
  );
}
