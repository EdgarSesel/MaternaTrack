import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-32 mb-1.5" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* AI Panel Summary skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-4 w-36 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
