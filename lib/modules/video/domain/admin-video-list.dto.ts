export type AdminVideoListItem = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  status: string;
  tier: string;
  thumbnailUrl: string | null;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number | null;
  provider?: string | null;
  views: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  migrationStatus: string;
  diagnosticsIssuesCount: number;
  publishAfterAssetReady: boolean;
  publishAfterAssetReadyCompletedAt: string | null;
  publishAfterAssetReadyError: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Scheduled premiere (ISO); upcoming while in the future (CLAUDE.md "Premieres"). */
  premiereAt?: string | null;
};

export type AdminVideosListResponse = {
  items: AdminVideoListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats?: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    public: number;
    loggedIn: number;
    patron: number;
  };
};

export const VIDEO_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'title',
  'views',
  'likesCount',
  'dislikesCount',
  'sidebarOrder',
  'status',
  'tier'
] as const;

export type VideoSortField = typeof VIDEO_SORT_FIELDS[number];
