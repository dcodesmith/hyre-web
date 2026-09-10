import { CarIcon, PlusIcon } from "lucide-react";
import { Link } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Button } from "~/components/ui/button";
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="fleet-cars-heading" className="text-2xl font-semibold tracking-tight">
            Your fleet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View vehicle status, approval, and pricing details.
          </p>
        </div>
        <Button asChild>
          <Link to="/fleet-owner/cars/new">
            <PlusIcon data-icon="inline-start" />
            Add Car
          </Link>
        </Button>
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
            <EmptyDescription>Add and verify your first car to get started.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
