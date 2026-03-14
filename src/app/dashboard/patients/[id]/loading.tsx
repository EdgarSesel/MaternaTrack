import { Skeleton } from "@/components/ui/skeleton";

export default function PatientDetailLoading() {
  return (
    <div className="space-y-5 max-w-5xl">
      <Skeleton className="h-8 w-28" />
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="flex gap-4 border-b border-slate-200 pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
