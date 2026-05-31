import { AccessTier } from '@prisma/client';

export const DEFAULT_SEED_MEDIA_URL = 'https://seed-media.localhost.invalid/sample-video.mp4';
export const DEFAULT_SEED_THUMBNAIL_URL = '/wuthering.jpg';

export type SeedVideoInput = {
  title: string;
  slug: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  tier: AccessTier;
  isMainFeatured: boolean;
  views: number;
  likesCount: number;
  dislikesCount: number;
};

export function createSeedVideosData({
  mediaUrl = DEFAULT_SEED_MEDIA_URL,
  thumbnailUrl = DEFAULT_SEED_THUMBNAIL_URL,
}: {
  mediaUrl?: string;
  thumbnailUrl?: string;
} = {}): SeedVideoInput[] {
  return [
    {
      title: 'Wuthering Heights - Kate Bush Cover',
      slug: 'wuthering-heights-cover',
      description: 'Moja interpretacja klasycznego utworu Kate Bush. Nagrane w jednym ujęciu, aby oddać surowość i emocje tej kompozycji.',
      videoUrl: mediaUrl,
      thumbnailUrl,
      duration: '04:12',
      tier: AccessTier.PUBLIC,
      isMainFeatured: true,
      views: 1250400,
      likesCount: 45000,
      dislikesCount: 120,
    },
    {
      title: 'Nie masz psychy się zalogować',
      slug: 'independency-2024',
      description: 'W tym odcinku analizuję, dlaczego twórcy muszą szukać alternatywnych dróg finansowania poza wielkimi korporacjami.',
      videoUrl: mediaUrl,
      thumbnailUrl,
      duration: '15:30',
      tier: AccessTier.LOGGED_IN,
      isMainFeatured: false,
      views: 85000,
      likesCount: 12000,
      dislikesCount: 50,
    },
    {
      title: 'Mój setup do nagrywania śledztw',
      slug: 'setup-tour',
      description: 'Pokazuję sprzęt, którego używam do tworzenia moich materiałów. Od kamer po mikrofony i oświetlenie.',
      videoUrl: mediaUrl,
      thumbnailUrl,
      duration: '22:15',
      tier: AccessTier.PATRON,
      isMainFeatured: false,
      views: 15000,
      likesCount: 3000,
      dislikesCount: 10,
    },
    {
      title: 'Niepublikowane materiały z ostatniego śledztwa',
      slug: 'unreleased-investigation',
      description: 'Tylko dla Patronów. Nagrania, które nie weszły do głównego materiału ze względu na ich kontrowersyjną naturę.',
      videoUrl: mediaUrl,
      thumbnailUrl,
      duration: '45:00',
      tier: AccessTier.PATRON,
      isMainFeatured: false,
      views: 5000,
      likesCount: 1500,
      dislikesCount: 5,
    },
    {
      title: 'Q&A: Odpowiedzi na Wasze najtrudniejsze pytania',
      slug: 'qa-session-1',
      description: 'Odpowiadam na pytania przesłane przez moich wspierających. Nic nie jest poza granicami.',
      videoUrl: mediaUrl,
      thumbnailUrl,
      duration: '32:10',
      tier: AccessTier.PATRON,
      isMainFeatured: false,
      views: 12000,
      likesCount: 2500,
      dislikesCount: 15,
    },
  ];
}
