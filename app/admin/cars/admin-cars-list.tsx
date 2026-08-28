import { CarIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router";

import type { AdminCarApprovalStatus, AdminCarsResponse } from "~/api/admin/cars/schema";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { AdminCarReviewBadge } from "./admin-car-review-badge";
import { type AdminCarsQuery, serializeAdminCarsQuery } from "./admin-cars-url";
import type { AdminCarListItem } from "./car-approval";

const filters: { label: string; value?: AdminCarApprovalStatus }[] = [
  { label: "All" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

function queryHref(query: AdminCarsQuery) {
  const search = serializeAdminCarsQuery(query).toString();
  return search ? `/admin/cars?${search}` : "/admin/cars";
}

function ownerName(car: AdminCarListItem) {
  return car.owner.name?.trim() || car.owner.username?.trim() || car.owner.email;
}

function detailHref(carId: string, query: AdminCarsQuery) {
  const search = serializeAdminCarsQuery(query).toString();
  return search ? `/admin/cars/${carId}?${search}` : `/admin/cars/${carId}`;
}

function Pagination({
  meta,
  query,
}: {
  readonly meta: AdminCarsResponse["meta"];
  readonly query: AdminCarsQuery;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Car review pagination"
      className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end"
    >
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Page {meta.page} of {meta.totalPages}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {meta.page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link to={queryHref({ ...query, page: meta.page - 1 })}>
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            <ChevronLeftIcon data-icon="inline-start" />
            Previous
          </Button>
        )}
        {meta.page < meta.totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link to={queryHref({ ...query, page: meta.page + 1 })}>
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </nav>
  );
}

export function AdminCarsList({
  cars,
  meta,
  query,
}: {
  readonly cars: AdminCarListItem[];
  readonly meta: AdminCarsResponse["meta"];
  readonly query: AdminCarsQuery;
}) {
  return (
    <section aria-labelledby="admin-cars-heading" className="space-y-5">
      <div>
        <h2 id="admin-cars-heading" className="text-2xl font-semibold tracking-tight">
          Car reviews
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review fleet vehicles, images, and documents.
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter cars by review status">
        {filters.map((filter) => {
          const active = query.approvalStatus === filter.value;
          return (
            <Button key={filter.label} asChild size="sm" variant={active ? "default" : "outline"}>
              <Link
                to={queryHref({ ...query, approvalStatus: filter.value, page: 1 })}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      {cars.length === 0 ? (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CarIcon />
            </EmptyMedia>
            <EmptyTitle>No cars found</EmptyTitle>
            <EmptyDescription>
              {query.approvalStatus
                ? `There are no ${query.approvalStatus.toLowerCase()} cars.`
                : "Cars submitted by fleet owners will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {cars.map((car) => (
              <Link
                key={car.id}
                to={detailHref(car.id, query)}
                className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {car.year} {car.make} {car.model}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {car.registrationNumber} · {ownerName(car)}
                    </p>
                  </div>
                  <AdminCarReviewBadge status={car.approvalStatus} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {car.pendingAssetCount} pending assets
                </p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <caption className="sr-only">Cars in the admin review queue</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Review status</TableHead>
                  <TableHead>Pending assets</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cars.map((car) => (
                  <TableRow key={car.id}>
                    <TableCell className="font-medium">
                      {car.year} {car.make} {car.model}
                    </TableCell>
                    <TableCell>{ownerName(car)}</TableCell>
                    <TableCell>{car.registrationNumber}</TableCell>
                    <TableCell>
                      <AdminCarReviewBadge status={car.approvalStatus} />
                    </TableCell>
                    <TableCell>{car.pendingAssetCount}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={detailHref(car.id, query)}>
                          <EyeIcon data-icon="inline-start" />
                          Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination meta={meta} query={query} />
        </>
      )}
    </section>
  );
}
