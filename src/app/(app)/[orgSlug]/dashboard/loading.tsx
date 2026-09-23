import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px] xl:gap-8">
      <div className="overflow-hidden rounded-2xl border">
        <div className="space-y-2 border-b px-5 py-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex gap-3 border-b px-5 py-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-3 py-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 border-b sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-5 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 border-b px-5 py-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
