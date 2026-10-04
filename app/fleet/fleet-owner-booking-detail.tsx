import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CarIcon,
  CheckCircle2Icon,
  MapPinIcon,
  UserRoundIcon,
} from "lucide-react";
import { Form, Link } from "react-router";
import type { FleetBookingDetail } from "~/api/fleet/bookings/schema";
import { formatTimelineDay, formatTimelineTime } from "~/booking/booking-domain";
import { BOOKING_TYPE_OPTIONS_MAP } from "~/booking/types";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type FleetBookingAssignmentActionData = {
  error?: string;
  success?: boolean;
};

type Booking = FleetBookingDetail["booking"];
type Chauffeurs = FleetBookingDetail["assignableChauffeurs"];

function initials(name: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "C"
  );
}

function TripDetailsCard({ booking }: { booking: Booking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trip details</CardTitle>
        <CardDescription>Operational information for this booking.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <CalendarDaysIcon className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Pickup</p>
              <p className="text-sm text-muted-foreground">
                {formatTimelineDay(booking.startDate)} at {formatTimelineTime(booking.startDate)}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <UserRoundIcon className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Customer</p>
              <p className="text-sm text-muted-foreground">{booking.customerName}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="grid gap-3">
            <div>
              <p className="font-medium">From</p>
              <p className="text-sm text-muted-foreground">{booking.pickupLocation}</p>
            </div>
            <div>
              <p className="font-medium">To</p>
              <p className="text-sm text-muted-foreground">{booking.returnLocation}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <CarIcon className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {booking.car.make} {booking.car.model} ({booking.car.year})
            </p>
            <p className="text-sm text-muted-foreground">{booking.car.registrationNumber}</p>
          </div>
        </div>

        {booking.flightNumber ? (
          <p className="text-sm">
            <span className="font-medium">Flight:</span> {booking.flightNumber}
          </p>
        ) : null}
        {booking.specialRequests ? (
          <div>
            <p className="font-medium">Special requests</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {booking.specialRequests}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CurrentAssignment({ booking, wasAssigned }: { booking: Booking; wasAssigned: boolean }) {
  if (!booking.chauffeur) {
    return wasAssigned ? null : (
      <Alert>
        <UserRoundIcon />
        <AlertTitle>Assignment required</AlertTitle>
        <AlertDescription>Select a chauffeur for this booking.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar size="lg">
        {booking.chauffeur.image ? <AvatarImage src={booking.chauffeur.image} alt="" /> : null}
        <AvatarFallback>{initials(booking.chauffeur.name)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm text-muted-foreground">Currently assigned</p>
        <p className="font-medium">{booking.chauffeur.name ?? "Chauffeur"}</p>
      </div>
    </div>
  );
}

function AssignmentFeedback({
  actionData,
}: {
  actionData: FleetBookingAssignmentActionData | undefined;
}) {
  if (actionData?.success) {
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>Assignment saved</AlertTitle>
        <AlertDescription>The selected chauffeur is now assigned to this booking.</AlertDescription>
      </Alert>
    );
  }
  if (actionData?.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Assignment failed</AlertTitle>
        <AlertDescription>{actionData.error}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function AssignmentControl({
  assignableChauffeurs,
  booking,
  isOwnerDriver,
  isSubmitting,
}: {
  assignableChauffeurs: Chauffeurs;
  booking: Booking;
  isOwnerDriver: boolean;
  isSubmitting: boolean;
}) {
  if (!booking.canAssignChauffeur) {
    return (
      <Alert>
        <AlertTitle>Assignment unavailable</AlertTitle>
        <AlertDescription>
          Chauffeurs can only be assigned while a booking is confirmed.
        </AlertDescription>
      </Alert>
    );
  }

  if (assignableChauffeurs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium">No chauffeur is available for this time.</p>
        {!isOwnerDriver ? (
          <Button asChild variant="link" className="mt-1 h-auto p-0">
            <Link to="/fleet-owner/chauffeurs">Manage chauffeurs</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const currentIsAssignable = assignableChauffeurs.some(
    (chauffeur) => chauffeur.id === booking.chauffeur?.id,
  );

  return (
    <Form method="post" className="grid gap-4">
      <Field>
        <FieldLabel htmlFor="chauffeur-assignment">Chauffeur</FieldLabel>
        <Select
          name="chauffeurId"
          defaultValue={currentIsAssignable ? booking.chauffeur?.id : undefined}
          required
        >
          <SelectTrigger id="chauffeur-assignment" className="h-10 w-full">
            <SelectValue placeholder="Select an available chauffeur" />
          </SelectTrigger>
          <SelectContent>
            {assignableChauffeurs.map((chauffeur) => (
              <SelectItem key={chauffeur.id} value={chauffeur.id}>
                {chauffeur.name ?? "Chauffeur"}
                {chauffeur.isOwnerDriver ? " (You)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Reassigning notifies both the new and previous chauffeur.
        </FieldDescription>
      </Field>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Assigning…"
          : booking.chauffeur
            ? "Reassign chauffeur"
            : "Assign chauffeur"}
      </Button>
    </Form>
  );
}

function AssignmentCard({
  actionData,
  assignableChauffeurs,
  booking,
  isOwnerDriver,
  isSubmitting,
}: {
  actionData: FleetBookingAssignmentActionData | undefined;
  assignableChauffeurs: Chauffeurs;
  booking: Booking;
  isOwnerDriver: boolean;
  isSubmitting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chauffeur assignment</CardTitle>
        <CardDescription>
          Only approved, active chauffeurs available for this trip are shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <CurrentAssignment booking={booking} wasAssigned={actionData?.success === true} />
        <AssignmentFeedback actionData={actionData} />
        <AssignmentControl
          assignableChauffeurs={assignableChauffeurs}
          booking={booking}
          isOwnerDriver={isOwnerDriver}
          isSubmitting={isSubmitting}
        />
      </CardContent>
    </Card>
  );
}

export function FleetOwnerBookingDetail({
  actionData,
  detail,
  isSubmitting,
}: {
  actionData: FleetBookingAssignmentActionData | undefined;
  detail: FleetBookingDetail & { isOwnerDriver: boolean };
  isSubmitting: boolean;
}) {
  const { assignableChauffeurs, booking, isOwnerDriver } = detail;

  return (
    <section aria-labelledby="fleet-booking-heading">
      <Button asChild variant="ghost" className="mb-4 -ml-2">
        <Link to="/fleet-owner/bookings">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to bookings
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="fleet-booking-heading" className="text-2xl font-semibold tracking-tight">
            {booking.bookingReference}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {BOOKING_TYPE_OPTIONS_MAP[booking.type].label} booking
          </p>
        </div>
        <Badge variant={booking.status === "CONFIRMED" ? "default" : "outline"}>
          {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <TripDetailsCard booking={booking} />
        <AssignmentCard
          actionData={actionData}
          assignableChauffeurs={assignableChauffeurs}
          booking={booking}
          isOwnerDriver={isOwnerDriver}
          isSubmitting={isSubmitting}
        />
      </div>
    </section>
  );
}
