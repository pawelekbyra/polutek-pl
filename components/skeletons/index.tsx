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

export function HomePageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      <div className="h-14 bg-white/80 border-b px-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto w-full px-4 md:px-6 lg:px-6 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <PlayerSkeleton />
            <div className="mt-[18px] mb-[14px]">
              <Skeleton className="h-[26px] w-3/4" />
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-[14px]">
              <div className="flex items-center gap-[13px]">
                <Skeleton className="w-[46px] h-[46px] rounded-full shrink-0" />
                <div className="space-y-[5px]">
                  <Skeleton className="h-[15px] w-[130px]" />
                  <Skeleton className="h-[12px] w-[90px]" />
                </div>
                <Skeleton className="ml-[6px] h-[34px] w-[110px] rounded-full" />
              </div>
              <div className="flex items-center gap-[9px]">
                <Skeleton className="h-[38px] w-[120px] rounded-full" />
                <Skeleton className="h-[38px] w-[90px] rounded-full" />
                <Skeleton className="h-[38px] w-[38px] rounded-full" />
              </div>
            </div>
            <div className="mt-[16px] bg-secondary rounded-[14px] p-[14px] space-y-[8px]">
              <div className="flex gap-2">
                <Skeleton className="h-[13px] w-[80px]" />
                <Skeleton className="h-[13px] w-[100px]" />
              </div>
              <Skeleton className="h-[13px] w-full" />
              <Skeleton className="h-[13px] w-5/6" />
              <Skeleton className="h-[13px] w-2/3" />
            </div>
          </div>
          <div className="hidden lg:block lg:col-span-4 space-y-4">
            <div className="pb-1 border-b border-neutral-100 mb-4">
              <Skeleton className="h-4 w-32" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex gap-2 p-1">
                <Skeleton className="w-[168px] h-[94px] rounded-md shrink-0 border border-neutral-300" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChannelPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-[1284px] mx-auto px-0 md:px-4 lg:px-6 pt-6">
        <Skeleton className="w-full aspect-[6/1] md:rounded-xl" />
      </div>
      <div className="max-w-[1284px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <Skeleton className="w-24 h-24 md:w-40 md:h-40 rounded-full shrink-0 border border-neutral-200 bg-white" />
          <div className="flex-1 text-center md:text-left space-y-3">
            <Skeleton className="h-10 w-64 mx-auto md:mx-0" />
            <div className="flex justify-center md:justify-start gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-full max-w-2xl" />
            <div className="pt-2">
              <Skeleton className="h-10 w-32 mx-auto md:mx-0 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex border-b border-neutral-200 mt-6 gap-8 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-8 w-20 mb-3" />
          ))}
        </div>
        <VideoGridSkeleton />
      </div>
    </div>
  );
}

export function PlayerSkeleton() {
  return (
    <div className="aspect-video w-full rounded-[14px] bg-neutral-200/70 relative overflow-hidden motion-reduce:after:hidden after:absolute after:inset-0 after:translate-x-[-100%] after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent" />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 py-6">
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
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-xl">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}
