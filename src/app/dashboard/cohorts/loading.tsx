export default function CohortLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
