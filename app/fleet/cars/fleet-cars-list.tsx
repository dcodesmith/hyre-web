import { CarIcon } from "lucide-react";

import type { FleetCar } from "~/api/fleet/cars/schema";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { FleetCarsTable } from "./fleet-cars-table";

export function FleetCarsList({ cars }: { readonly cars: FleetCar[] }) {
  return (
    <section aria-labelledby="fleet-cars-heading">
      <div className="mb-6">
        <h2 id="fleet-cars-heading" className="text-2xl font-semibold tracking-tight">
          Your fleet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View vehicle status, approval, and pricing details.
        </p>
      </div>

      {cars.length > 0 ? (
        <FleetCarsTable cars={cars} />
      ) : (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CarIcon />
            </EmptyMedia>
            <EmptyTitle>No cars yet</EmptyTitle>
            <EmptyDescription>Cars added to your fleet will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
