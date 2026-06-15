export type AdminChannelDto = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  bannerUrl: string | null;
  subscribersCount: number;
  displaySubscribersCount: number | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    imageUrl: string | null;
  } | null;
};
