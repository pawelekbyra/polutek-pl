import { AdminStatTile } from "@/app/admin/components/AdminStatTile";

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
      <AdminStatTile size="compact" label="Wszystkie" value={stats.total} />
      <AdminStatTile size="compact" label="Publikacje" value={stats.published} color="green" />
      <AdminStatTile size="compact" label="Szkice" value={stats.drafts} color="amber" />
      <AdminStatTile size="compact" label="Archiv" value={stats.archived} color="red" />
      <AdminStatTile size="compact" label="Public" value={stats.public} />
      <AdminStatTile size="compact" label="Login" value={stats.loggedIn} />
      <AdminStatTile size="compact" label="Patron" value={stats.patron} color="amber" />
    </div>
  );
}
