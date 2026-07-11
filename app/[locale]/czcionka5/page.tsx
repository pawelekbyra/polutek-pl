import { redirect } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getLocalizedHref } from "@/lib/i18n/routing";
import FontVariantWrapper from "@/app/components/FontVariantWrapper";
import ChannelHome from "@/app/components/ChannelHome";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { PublicVideoDTO } from "@/app/types/video";
import { getHomeContentCached } from "@/lib/modules/channel/application/home-content.loader";
import { auth, currentUser } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function FontVariant5() {
  const initialLanguage = await resolveInitialLanguage();

  const getSafeAuth = async () => {
    try {
      return await auth();
    } catch (e) {
      logger.error("[FONT_TEST_AUTH_ERROR]", e);
      return { userId: null as string | null };
    }
  };

  const [authData, content, user] = await Promise.all([
    getSafeAuth(),
    getHomeContentCached(),
    currentUser().catch((e) => {
      logger.error("[FONT_TEST_CURRENT_USER_ERROR]", e);
      return null;
    }),
  ]);

  const userId = authData.userId;
  const { mainVideo, allVideos, creator } = content.status !== "error"
    ? content
    : { mainVideo: null, allVideos: [] as PublicVideoDTO[], creator: null };

  const userProfile = userId && user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        imageUrl: user.imageUrl,
        totalPaid: 0,
        isPatronDecorative: false,
      }
    : null;

  return (
    <FontVariantWrapper
      variant={5}
      title="Artistic Premium"
      description="Cormorant Garamond + Crimson Text"
    >
      <Navbar />
      <ChannelHome
        mainVideo={mainVideo}
        allVideos={allVideos}
        userProfile={userProfile}
      />
      <Footer />
    </FontVariantWrapper>
  );
}
