import { Skeleton } from "./ui/skeleton";

interface CarSkeletonProps {
  readonly count?: number;
  readonly grid?: boolean;
}

export function CarSkeleton({ count = 6, grid = false }: CarSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (grid) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skeletons.map((i) => (
          <div key={i} className="overflow-hidden space-y-3">
            {/* Match the real card image: w-full at a 4:3 aspect ratio */}
            <Skeleton className="w-full aspect-[4/3] rounded-xl" />
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-0.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal carousel layout
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
      {skeletons.map((i) => (
        <div key={i} className="flex-shrink-0 w-[220px] md:w-[250px] space-y-3">
          {/* Match the real card image: w-full at a 4:3 aspect ratio */}
          <Skeleton className="w-full aspect-[4/3] rounded-xl" />
          {/* Content skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for category sections
 * Shows title skeleton and card skeletons in carousel layout
 */
export function CategorySkeleton({ count = 3 }: { readonly count?: number }) {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <Skeleton className="h-8 w-32" />
      </div>
      {/* Cards skeleton */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <CarSkeleton count={count} grid={false} />
      </div>
    </div>
  );
}
