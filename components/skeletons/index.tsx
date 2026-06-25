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
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <PlayerSkeleton />
            <div className="space-y-4 pt-3">
              <Skeleton className="h-8 w-3/4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-xl bg-[#ebebeb]" />
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
    <div className="aspect-video w-full bg-neutral-900 rounded-xl relative overflow-hidden group">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[15px] border-l-white/20 border-b-[10px] border-b-transparent ml-1" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4 bg-gradient-to-t from-black/60 to-transparent">
        <Skeleton className="h-1.5 w-full bg-white/20" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5 bg-white/20" />
            <Skeleton className="h-5 w-5 bg-white/20" />
            <Skeleton className="h-5 w-20 bg-white/20" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5 bg-white/20" />
            <Skeleton className="h-5 w-5 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
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

export function SupportBoxSkeleton() {
  return (
    <div className="p-4 border rounded-xl space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
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
