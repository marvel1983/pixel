import { Skeleton } from "@/components/ui/skeleton";

function ProductCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden">
      <Skeleton className="aspect-[3/4] rounded-none" />
      <div className="p-3 flex flex-col items-center gap-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-0.5 my-0.5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-3 w-3 rounded-full" />)}
        </div>
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-full rounded-lg mt-1" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex-1" aria-busy="true" aria-label="Loading products">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-44 rounded-md" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
