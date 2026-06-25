import { VideoFilters } from "./VideoFilters";

interface AdminVideoFiltersViewProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  fetchVideos: (page: number, options?: { pending?: boolean }) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  tierFilter: string;
  setTierFilter: (val: string) => void;
  sourceKindFilter: string;
  setSourceKindFilter: (val: string) => void;
  migrationStatusFilter: string;
  setMigrationStatusFilter: (val: string) => void;
  isMainFeatured: string;
  setIsMainFeatured: (val: string) => void;
  showInSidebar: string;
  setShowInSidebar: (val: string) => void;
  orderBy: string;
  setOrderBy: (val: string) => void;
  needsAttention: boolean;
  setNeedsAttention: (val: boolean) => void;
}

export function AdminVideoFiltersView({
  searchQuery, setSearchQuery, fetchVideos,
  statusFilter, setStatusFilter,
  tierFilter, setTierFilter,
  sourceKindFilter, setSourceKindFilter,
  migrationStatusFilter, setMigrationStatusFilter,
  isMainFeatured, setIsMainFeatured,
  showInSidebar, setShowInSidebar,
  orderBy, setOrderBy,
  needsAttention, setNeedsAttention
}: AdminVideoFiltersViewProps) {
  return (
    <VideoFilters
      searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onSearchSubmit={() => fetchVideos(1, { pending: true })}
      statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
      tierFilter={tierFilter} onTierFilterChange={setTierFilter}
      sourceKindFilter={sourceKindFilter} onSourceKindFilterChange={setSourceKindFilter}
      migrationStatusFilter={migrationStatusFilter} onMigrationStatusFilterChange={setMigrationStatusFilter}
      isMainFeatured={isMainFeatured} onIsMainFeaturedChange={setIsMainFeatured}
      showInSidebar={showInSidebar} onShowInSidebarChange={setShowInSidebar}
      orderBy={orderBy} onOrderByChange={setOrderBy}
      needsAttention={needsAttention} onNeedsAttentionChange={setNeedsAttention}
    />
  );
}
