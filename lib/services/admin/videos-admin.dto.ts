export type AdminVideoListItem = {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  status: string;
  tier: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number;
  sourceKind: string;
  provider: string;
  views: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  diagnosticsIssuesCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
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
  'title',
  'views',
  'status',
  'sidebarOrder'
] as const;

export type VideoSortField = typeof VIDEO_SORT_FIELDS[number];
