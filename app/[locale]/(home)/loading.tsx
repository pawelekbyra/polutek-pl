import { HomePageSkeleton } from "@/components/skeletons";

export default function LocalizedHomeLoading() {
  return (
    <div className="animate-in fade-in duration-300" suppressHydrationWarning>
      <HomePageSkeleton />
    </div>
  );
}
