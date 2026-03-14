import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-36 mb-1.5" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div>
              <Skeleton className="h-7 w-10 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
