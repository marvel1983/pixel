import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8" aria-busy="true" aria-label="Loading product">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* 3-col grid */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr_300px] lg:items-start">
        {/* Image column */}
        <Skeleton className="aspect-square rounded-lg" />

        {/* Meta column */}
        <div className="border rounded-lg p-5 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4" />
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-4 rounded-full" />)}
            <Skeleton className="h-4 w-24 ml-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        </div>

        {/* Purchase card column */}
        <div className="border rounded-lg p-5 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="pt-3 border-t space-y-2.5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-3 w-4/5" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
