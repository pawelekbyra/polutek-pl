import { AccessTier, VideoStatus } from "@prisma/client";
import { InternalVideoDTO as Video } from "@/app/types/video";
import { MAIN_CREATOR_NAME, MAIN_CREATOR_SLUG } from '../constants';

export const DEFAULT_CREATOR = {
  id: "creator_polutek_default",
  name: MAIN_CREATOR_NAME,
  slug: MAIN_CREATOR_SLUG,
  bio: `Oficjalny kanał ${MAIN_CREATOR_NAME}. Ekskluzywne materiały VOD i niezależne śledztwa.`,
  bannerUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
  subscribersCount: 1250000,
};

export const INITIAL_VIDEOS: Video[] = [
  {
    id: "v_fallback_001",
    creatorId: DEFAULT_CREATOR.id,
    title: "You don't have the guts to log in",
    slug: "wuthering-heights-cover",
    description: "Moja interpretacja klasycznego utworu Kate Bush. Nagrane w jednym ujęciu, aby oddać surowość i emocje tej kompozycji.",
    videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4",
    thumbnailUrl: "/wuthering.jpg",
    duration: "04:12",
    tier: AccessTier.PUBLIC,
    isMainFeatured: true,
    status: VideoStatus.PUBLISHED,
    views: 1250400,
    likesCount: 45000,
    dislikesCount: 120,
    publishedAt: new Date(),
    creator: DEFAULT_CREATOR,
  },
  {
    id: "v_fallback_002",
    creatorId: DEFAULT_CREATOR.id,
    title: "Secret Project",
    slug: "historia-powstania-osady",
    description: "Materiał o historii powstania osady.",
    videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/historia-powstania-osady-natury-zew-w-gruncie-ruchu-stefan.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop",
    duration: "10:00",
    tier: AccessTier.LOGGED_IN,
    isMainFeatured: false,
    status: VideoStatus.PUBLISHED,
    views: 85000,
    likesCount: 12000,
    dislikesCount: 50,
    publishedAt: new Date("2024-03-14T10:00:00Z"),
    creator: DEFAULT_CREATOR,
  },
  {
    id: "v_fallback_003",
    creatorId: DEFAULT_CREATOR.id,
    title: "Udało się!!!",
    slug: "intencja-swiadomosc-sprawczosci",
    description: "Q&A z Michałem Kicińskim z Festiwalu Wibracje.",
    videoUrl: "https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/intencja-swiadomosc-sprawczosci-michal-kicinski-qa-festiwal-wibracje.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2670&auto=format&fit=crop",
    duration: "22:15",
    tier: AccessTier.PATRON,
    isMainFeatured: false,
    status: VideoStatus.PUBLISHED,
    views: 15000,
    likesCount: 3000,
    dislikesCount: 10,
    publishedAt: new Date("2024-03-07T14:30:00Z"),
    creator: DEFAULT_CREATOR,
  }
];
