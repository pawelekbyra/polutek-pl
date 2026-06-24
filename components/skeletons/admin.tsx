import { Skeleton } from "@/components/ui/skeleton";

export function AdminPageHeaderSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 border border-neutral-200 rounded-xl space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 8, cols = 6 }: { rows?: number, cols?: number }) {
  return (
    <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden shadow-sm">
      <div className="border-b border-neutral-100 bg-neutral-50/50 p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-32" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="p-4">
                    <div className="flex items-center gap-3">
                      {j === 0 && <Skeleton className="h-10 w-16 rounded-md shrink-0" />}
                      <Skeleton className={`h-4 ${j === 1 ? 'w-48' : 'w-24'}`} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function AdminFormSkeleton() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-6 p-6 border border-neutral-200 rounded-xl bg-white shadow-sm">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function AdminVideosPageSkeleton() {
  return (
    <div className="p-8">
      <AdminPageHeaderSkeleton />
      <StatCardsSkeleton />
      <AdminTableSkeleton cols={7} />
    </div>
  );
}

export function AdminVideoDetailsSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-8 w-96" />
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPageSkeleton() {
  return (
    <div className="p-8">
      <AdminPageHeaderSkeleton />
      <StatCardsSkeleton />
      <AdminTableSkeleton cols={8} />
    </div>
  );
}

export function AdminPaymentsPageSkeleton() {
  return (
    <div className="p-8">
      <AdminPageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <AdminTableSkeleton cols={6} />
    </div>
  );
}

export function AdminVideoLayoutSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <AdminPageHeaderSkeleton />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="border border-neutral-200 rounded-xl p-4 bg-white shadow-sm">
             <Skeleton className="aspect-video w-full rounded-xl mb-4 border border-neutral-300" />
             <Skeleton className="h-6 w-3/4" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 border border-neutral-100 rounded-xl bg-white">
                <Skeleton className="h-8 w-8 rounded bg-muted" />
                <Skeleton className="h-10 w-16 rounded-md" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminUserDetailsSkeleton() {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-4 border-b">
           <Skeleton className="h-10 w-24" />
           <Skeleton className="h-10 w-24" />
           <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2">
             <AdminTableSkeleton rows={5} />
           </div>
           <div className="space-y-6">
              <div className="border rounded-xl p-6 space-y-4">
                 <Skeleton className="h-6 w-32" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-20 w-full" />
              </div>
           </div>
        </div>
      </div>
    );
}

export function AdminUsersDashboardSkeleton() {
    return (
        <div className="p-8">
            <AdminPageHeaderSkeleton />
            <StatCardsSkeleton count={12} />
            <div className="grid lg:grid-cols-2 gap-8 mt-8">
                <div className="border rounded-xl p-6 space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                </div>
                <div className="border rounded-xl p-6 space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AdminHomeSkeleton() {
    return (
        <div className="p-8">
            <AdminPageHeaderSkeleton />
            <StatCardsSkeleton />
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                   <div className="border rounded-xl p-6 h-[400px]">
                      <Skeleton className="h-full w-full" />
                   </div>
                </div>
                <div className="space-y-8">
                    <div className="border rounded-xl p-6 space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1">
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-2 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
