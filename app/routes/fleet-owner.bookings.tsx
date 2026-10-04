import {
  CalendarDaysIcon,
  CarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  UserRoundIcon,
} from "lucide-react";
import { Link, redirect, useRevalidator } from "react-router";
import { z } from "zod";
import { getFleetBookings } from "~/api/fleet/bookings/bookings.server";
import type { FleetBookingStatus } from "~/api/fleet/bookings/schema";
import { formatTimelineDay, formatTimelineTime } from "~/booking/booking-domain";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.bookings";

const NO_STORE = { "Cache-Control": "private, no-store" };
const PAGE_SIZE = 20;

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Bookings | Tripdly",
    description: "View bookings and assign chauffeurs for your Tripdly fleet.",
    path: "/fleet-owner/bookings",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

function pagePath(page: number) {
  return page > 1 ? `/fleet-owner/bookings?page=${page}` : "/fleet-owner/bookings";
}

export async function loader({ request }: Route.LoaderArgs) {
  const page = z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(new URL(request.url).searchParams.get("page") ?? 1);
  const { data: bookings } = await getFleetBookings({
    request,
    searchParams: new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) }),
  });
  const totalPages = Math.max(1, bookings.meta.totalPages);

  if (page > totalPages) {
    throw redirect(pagePath(totalPages), { headers: NO_STORE });
  }

  return { bookings: bookings.items, page, total: bookings.meta.total, totalPages };
}

function statusVariant(status: FleetBookingStatus) {
  if (status === "CONFIRMED") return "default";
  if (status === "CANCELLED" || status === "REJECTED" || status === "EXPIRED") {
    return "destructive";
  }
  return "outline";
}

function statusLabel(status: FleetBookingStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function FleetOwnerBookingsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <section aria-labelledby="fleet-bookings-heading">
      <div className="mb-6">
        <h2 id="fleet-bookings-heading" className="text-2xl font-semibold tracking-tight">
          Bookings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review trips and assign chauffeurs to confirmed bookings.
        </p>
      </div>

      {loaderData.bookings.length === 0 ? (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>No bookings yet</EmptyTitle>
            <EmptyDescription>New paid bookings for your cars will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {loaderData.bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      <Link className="hover:underline" to={`/fleet-owner/bookings/${booking.id}`}>
                        {booking.bookingReference}
                      </Link>
                    </CardTitle>
                    <Badge variant={statusVariant(booking.status)}>
                      {statusLabel(booking.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTimelineDay(booking.startDate)} at{" "}
                    {formatTimelineTime(booking.startDate)}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <p className="flex items-start gap-2">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      {booking.pickupLocation}
                      <span className="block text-muted-foreground">
                        to {booking.returnLocation}
                      </span>
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CarIcon className="size-4 text-muted-foreground" />
                    {booking.car.make} {booking.car.model} · {booking.car.registrationNumber}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRoundIcon className="size-4 text-muted-foreground" />
                    {booking.chauffeur?.name ?? "Chauffeur not assigned"}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant={booking.canAssignChauffeur ? "default" : "outline"}>
                    <Link to={`/fleet-owner/bookings/${booking.id}`}>
                      {booking.canAssignChauffeur
                        ? booking.chauffeur
                          ? "Review assignment"
                          : "Assign chauffeur"
                        : "View booking"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {loaderData.totalPages > 1 ? (
            <nav
              aria-label="Booking pages"
              className="mt-6 flex items-center justify-between gap-4"
            >
              <p className="text-sm text-muted-foreground">
                Page {loaderData.page} of {loaderData.totalPages} · {loaderData.total} bookings
              </p>
              <div className="flex gap-2">
                <Button
                  asChild={loaderData.page > 1}
                  variant="outline"
                  disabled={loaderData.page <= 1}
                >
                  {loaderData.page > 1 ? (
                    <Link to={pagePath(loaderData.page - 1)}>
                      <ChevronLeftIcon data-icon="inline-start" />
                      Previous
                    </Link>
                  ) : (
                    <>
                      <ChevronLeftIcon data-icon="inline-start" />
                      Previous
                    </>
                  )}
                </Button>
                <Button
                  asChild={loaderData.page < loaderData.totalPages}
                  variant="outline"
                  disabled={loaderData.page >= loaderData.totalPages}
                >
                  {loaderData.page < loaderData.totalPages ? (
                    <Link to={pagePath(loaderData.page + 1)}>
                      Next
                      <ChevronRightIcon data-icon="inline-end" />
                    </Link>
                  ) : (
                    <>
                      Next
                      <ChevronRightIcon data-icon="inline-end" />
                    </>
                  )}
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load bookings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
      <Button
        type="button"
        className="mt-5"
        disabled={revalidator.state !== "idle"}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state === "idle" ? "Retry" : "Retrying…"}
      </Button>
    </div>
  );
}
