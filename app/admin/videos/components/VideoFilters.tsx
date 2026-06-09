import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "@/app/components/icons";

interface VideoFiltersProps {
    searchQuery: string;
    onSearchQueryChange: (val: string) => void;
    onSearchSubmit: () => void;
    statusFilter: string;
    onStatusFilterChange: (val: string) => void;
    tierFilter: string;
    onTierFilterChange: (val: string) => void;
    sourceKindFilter: string;
    onSourceKindFilterChange: (val: string) => void;
    isMainFeatured: string;
    onIsMainFeaturedChange: (val: string) => void;
    showInSidebar: string;
    onShowInSidebarChange: (val: string) => void;
    orderBy: string;
    onOrderByChange: (val: string) => void;
    needsAttention: boolean;
    onNeedsAttentionChange: (val: boolean) => void;
}

export function VideoFilters({
    searchQuery,
    onSearchQueryChange,
    onSearchSubmit,
    statusFilter,
    onStatusFilterChange,
    tierFilter,
    onTierFilterChange,
    sourceKindFilter,
    onSourceKindFilterChange,
    isMainFeatured,
    onIsMainFeaturedChange,
    showInSidebar,
    onShowInSidebarChange,
    orderBy,
    onOrderByChange,
    needsAttention,
    onNeedsAttentionChange
}: VideoFiltersProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <form onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }} className="w-full lg:w-1/3 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Szukaj po tytule, slugu..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                        />
                    </div>
                    <Button type="submit">Szukaj</Button>
                </form>

                <div className="flex flex-wrap gap-2 items-center flex-1">
                    <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v || 'ALL')}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
                            <SelectItem value="PUBLISHED">Opublikowane</SelectItem>
                            <SelectItem value="DRAFT">Szkice</SelectItem>
                            <SelectItem value="ARCHIVED">Zarchiwizowane</SelectItem>
                            <SelectItem value="UNLISTED">Niepubliczne</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={tierFilter} onValueChange={(v) => onTierFilterChange(v || 'ALL')}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Poziom" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie poziomy</SelectItem>
                            <SelectItem value="PUBLIC">Publiczne</SelectItem>
                            <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
                            <SelectItem value="PATRON">Patroni</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sourceKindFilter} onValueChange={(v) => onSourceKindFilterChange(v || 'ALL')}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Źródło" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie źródła</SelectItem>
                            <SelectItem value="YOUTUBE">YouTube</SelectItem>
                            <SelectItem value="VIMEO">Vimeo</SelectItem>
                            <SelectItem value="VERCEL_BLOB">Vercel Blob</SelectItem>
                            <SelectItem value="HLS">HLS</SelectItem>
                            <SelectItem value="DASH">DASH</SelectItem>
                            <SelectItem value="MP4">MP4</SelectItem>
                            <SelectItem value="DIRECT">Direct (Legacy)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={isMainFeatured} onValueChange={(v) => onIsMainFeaturedChange(v || 'ALL')}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Hero" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Hero: Dowolny</SelectItem>
                            <SelectItem value="true">Tylko Hero</SelectItem>
                            <SelectItem value="false">Bez Hero</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={showInSidebar} onValueChange={(v) => onShowInSidebarChange(v || 'ALL')}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Sidebar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Sidebar: Dowolny</SelectItem>
                            <SelectItem value="true">W sidebarze</SelectItem>
                            <SelectItem value="false">Ukryte</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={orderBy} onValueChange={(v) => onOrderByChange(v || 'createdAt')}>
                        <SelectTrigger className="w-[160px] h-9">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3 w-3 opacity-70" />
                                <SelectValue placeholder="Sortuj" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Najnowsze</SelectItem>
                            <SelectItem value="views">Najwięcej wyświetleń</SelectItem>
                            <SelectItem value="likesCount">Najwięcej polubień</SelectItem>
                            <SelectItem value="sidebarOrder">Kolejność sidebar</SelectItem>
                            <SelectItem value="updatedAt">Ostatnio zmienione</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-md h-9">
                        <Checkbox id="attention" checked={needsAttention} onCheckedChange={(val) => onNeedsAttentionChange(!!val)} />
                        <Label htmlFor="attention" className="text-xs font-medium cursor-pointer">Wymaga uwagi</Label>
                    </div>
                </div>
            </div>
        </div>
    );
}
