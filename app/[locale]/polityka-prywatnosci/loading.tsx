import { LegalDocSkeleton } from "@/components/skeletons";

export default function PolitykaPrywatnosciLoading() {
  return (
    <div className="animate-in fade-in duration-300" suppressHydrationWarning>
      <LegalDocSkeleton />
    </div>
  );
}
