import { Skeleton } from "@/components/ui/skeleton";

export function PageShellSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 border-b flex items-center px-4 gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Standing in for the public home/channel shell (Navbar + Hero player card +
 * comments card + sidebar playlist). It mirrors the real layout's tokens,
 * container widths, card frames and element proportions so the hand-off from
 * skeleton to hydrated content lands without a colour flash or geometry jump.
 */
export function HomePageSkeleton() {
  return (
    <div className="public-visual-shell flex min-h-screen flex-col bg-[var(--chan-nav)]">
      <SkeletonNavbar />
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-8 pt-4 md:px-6 lg:px-8 lg:pt-5">
        <div className="grid grid-cols-12 gap-5 lg:items-start xl:gap-6">
          <div className="col-span-12 flex flex-col lg:col-span-8">
            <div className="rounded-[26px] border border-[var(--cm-line-80)] bg-[var(--cm-card-92-white)] p-2.5 md:p-3">
              <Skeleton className="aspect-video w-full rounded-[20px] md:rounded-[22px]" />
              <div className="space-y-3 px-1 pb-1 pt-4 md:px-2">
                <Skeleton className="h-[26px] w-3/4" />
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-[13px]">
                    <Skeleton className="h-[46px] w-[46px] shrink-0 rounded-full" />
                    <div className="space-y-[5px]">
                      <Skeleton className="h-[15px] w-[130px]" />
                      <Skeleton className="h-[12px] w-[90px]" />
                    </div>
                    <Skeleton className="ml-[6px] h-[34px] w-[110px] rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-[42px] w-[120px] rounded-[12px]" />
                    <Skeleton className="h-[42px] w-[92px] rounded-[12px]" />
                    <Skeleton className="h-[42px] w-[42px] rounded-[12px]" />
                  </div>
                </div>
                <div className="mt-1 rounded-[18px] border border-[var(--cm-line-70)] bg-[var(--chan-surface)] px-4 py-3 space-y-2 md:px-5">
                  <div className="flex gap-2">
                    <Skeleton className="h-[13px] w-[80px]" />
                    <Skeleton className="h-[13px] w-[100px]" />
                  </div>
                  <Skeleton className="h-[13px] w-full" />
                  <Skeleton className="h-[13px] w-2/3" />
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-88-white)] px-5 py-4">
              <div className="flex gap-2">
                <Skeleton className="h-[14px] w-[90px]" />
                <Skeleton className="h-[14px] w-[110px]" />
              </div>
              <div className="mt-4 space-y-4 py-6">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
            <div className="rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-88-white)] p-3">
              <div className="mb-3 border-b border-[var(--cm-line-76-2)] pb-2">
                <Skeleton className="h-[13px] w-28" />
              </div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <Skeleton className="h-[76px] w-[135px] shrink-0 rounded-[12px]" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-[13px] w-full" />
                      <Skeleton className="h-[13px] w-2/3" />
                      <Skeleton className="h-[11px] w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared navbar placeholder used by the home and channel skeletons. Reuses the
 * real `polutek-watch-nav` chrome so the sticky bar's gradient, blur and border
 * are identical before and after hydration — only the controls are shimmering.
 */
function SkeletonNavbar() {
  return (
    <div className="polutek-watch-nav sticky top-0 z-[1000] flex w-full flex-col">
      <div className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-2 md:gap-5 md:px-6 lg:px-8">
        <Skeleton className="h-[26px] w-[132px]" />
        <div className="mx-2 hidden max-w-[548px] flex-1 md:flex">
          <Skeleton className="h-[38px] w-full rounded-full" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Skeleton className="h-[38px] w-[78px] rounded-full" />
          <Skeleton className="h-[38px] w-[38px] rounded-full" />
          <Skeleton className="h-[38px] w-[92px] rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder for the creator channel page (Navbar + banner + profile header +
 * single tab + video grid). Colours, container widths, avatar size and the tab
 * count all track the real page so there's no warm/cool flash on hand-off.
 */
export function ChannelPageSkeleton() {
  return (
    <div className="channel-page-shell min-h-screen bg-[var(--chan-nav)]">
      <SkeletonNavbar />
      <div className="max-w-[1284px] mx-auto px-0 md:px-4 lg:px-6">
        <Skeleton className="w-full aspect-[6/1] rounded-none md:rounded-xl" />
      </div>
      <div className="max-w-[1284px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-7">
          <Skeleton className="w-24 h-24 md:w-36 md:h-36 rounded-full shrink-0" />
          <div className="flex-1 w-full text-center md:text-left space-y-3">
            <Skeleton className="h-9 w-64 mx-auto md:mx-0 md:h-11" />
            <div className="flex justify-center md:justify-start gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-full max-w-2xl mx-auto md:mx-0" />
            <div className="pt-2 flex justify-center md:justify-start">
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex border-b border-[var(--cm-line-76-2)] mt-7 gap-8 overflow-hidden">
          <Skeleton className="h-7 w-20 mb-3" />
        </div>
        <VideoGridSkeleton />
      </div>
    </div>
  );
}

export function PlayerSkeleton() {
  return (
    <div aria-hidden="true" className="app-skeleton aspect-video w-full rounded-[14px] bg-neutral-200/70 relative isolate overflow-hidden" />
  );
}

export function VideoCardSkeleton() {
  // Mirrors ChannelVideoCard: a rounded-[13px] thumbnail then title + meta.
  // The real card has no avatar, so the placeholder must not draw one either.
  return (
    <div className="flex flex-col">
      <Skeleton className="mb-3 aspect-video w-full rounded-[13px]" />
      <div className="space-y-2">
        <Skeleton className="h-[14px] w-full" />
        <Skeleton className="h-[14px] w-3/4" />
        <Skeleton className="h-[12px] w-1/2" />
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8 py-7">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SidebarPlaylistSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex gap-3 p-2">
            <Skeleton className="w-32 aspect-video rounded-lg shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TipsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--cm-line-80)] bg-[var(--chan-card)] p-5"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CommentLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="py-6 space-y-4">
      {Array.from({ length: count }, (_, i) => i + 1).map(i => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
