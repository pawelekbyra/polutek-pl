export interface AdminChannelSettingsDTO {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  bannerUrl: string | null;
  subscribersCount: number;
  displaySubscribersCount: number | null;
  user: {
    imageUrl: string | null;
    name: string | null;
  } | null;
}
