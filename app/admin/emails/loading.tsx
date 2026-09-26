import React from "react";
import { AdminTableSkeleton, AdminPageHeaderSkeleton } from "@/components/skeletons/admin";

export default function AdminEmailsLoading() {
  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <AdminPageHeaderSkeleton />
        <div className="bg-card p-6 rounded-xl border">
          <AdminTableSkeleton rows={6} cols={5} />
        </div>
      </div>
    </div>
  );
}
