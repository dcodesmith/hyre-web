import { Skeleton } from "~/components/ui/skeleton";

const SKELETON_KEYS = ["one", "two", "three", "four", "five", "six"] as const;

interface CarSkeletonProps {
  readonly count?: number;
}

export function CarSkeleton({ count = 6 }: CarSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {SKELETON_KEYS.slice(0, count).map((key) => (
        <div key={key} className="flex flex-col gap-3 overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-0.5 h-4 w-1/2" />
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
