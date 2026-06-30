import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, ChevronDown, ChevronUp } from "@/app/components/icons";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
    migrationStatusFilter: string;
    onMigrationStatusFilterChange: (val: string) => void;
    needsAttention: boolean;
    onNeedsAttentionChange: (val: boolean) => void;
    onResetFilters?: () => void;
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
    migrationStatusFilter,
    onMigrationStatusFilterChange,
    needsAttention,
    onNeedsAttentionChange,
    onResetFilters
}: VideoFiltersProps) {
    const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

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

                    <Button
                        variant="outline"
                        size="sm"
                        className={cn("h-9 gap-2", isMoreFiltersOpen && "bg-muted")}
                        onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
                    >
                        <Filter className="h-4 w-4" />
                        Więcej filtrów
                        {isMoreFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>

                    {onResetFilters && (
                        <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground" onClick={onResetFilters}>
                            <X className="h-4 w-4" />
                            Wyczyść
                        </Button>
                    )}
                </div>
            </div>

            {isMoreFiltersOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border bg-muted/30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Źródło</Label>
                        <Select value={sourceKindFilter} onValueChange={(v) => onSourceKindFilterChange(v || 'ALL')}>
                            <SelectTrigger className="w-full h-9 bg-background">
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
                                <SelectItem value="DIRECT">Bezpośredni URL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Migracja</Label>
                        <Select value={migrationStatusFilter} onValueChange={(v) => onMigrationStatusFilterChange(v || 'ALL')}>
                            <SelectTrigger className="w-full h-9 bg-background">
                                <SelectValue placeholder="Migracja" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Stan migracji</SelectItem>
                                <SelectItem value="READY">Gotowe (CF)</SelectItem>
                                <SelectItem value="MIGRATION_REQUIRED">Wymaga migracji</SelectItem>
                                <SelectItem value="PROCESSING">Przetwarzanie (CF)</SelectItem>
                                <SelectItem value="FAILED">Błąd (CF)</SelectItem>
                                <SelectItem value="MISSING_SOURCE">Brak źródła</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ekspozycja</Label>
                        <div className="flex gap-2">
                            <Select value={isMainFeatured} onValueChange={(v) => onIsMainFeaturedChange(v || 'ALL')}>
                                <SelectTrigger className="flex-1 h-9 bg-background text-xs">
                                    <SelectValue placeholder="Hero" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Hero: Dowolny</SelectItem>
                                    <SelectItem value="true">Tylko Hero</SelectItem>
                                    <SelectItem value="false">Bez Hero</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={showInSidebar} onValueChange={(v) => onShowInSidebarChange(v || 'ALL')}>
                                <SelectTrigger className="flex-1 h-9 bg-background text-xs">
                                    <SelectValue placeholder="Sidebar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Sidebar: Dowolny</SelectItem>
                                    <SelectItem value="true">W sidebarze</SelectItem>
                                    <SelectItem value="false">Ukryte</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-end pb-0.5">
                        <div className="flex items-center space-x-2 bg-background border px-3 py-1.5 rounded-md h-9 w-full">
                            <Checkbox id="attention" checked={needsAttention} onCheckedChange={(val: boolean | "indeterminate") => onNeedsAttentionChange(!!val)} />
                            <Label htmlFor="attention" className="text-xs font-medium cursor-pointer">Wymaga uwagi</Label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
