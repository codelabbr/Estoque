import { Skeleton } from "@/components/ui/skeleton";

export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <div className="border-b px-5 py-3">
          <Skeleton className="h-10 w-full max-w-sm rounded-full" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-5 py-3 last:border-b-0"
          >
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DetailPageSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </>
  );
}
