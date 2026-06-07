import { AdminTableSkeleton, AdminPageHeaderSkeleton } from "@/components/skeletons/admin";

export default function Loading() {
  return (
    <div className="p-8">
      <AdminPageHeaderSkeleton />
      <AdminTableSkeleton />
    </div>
  );
}
