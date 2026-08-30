import { ArrowLeft, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import type { BookingDetail, BookingDetailLeg } from "~/api/bookings/schema";
import type { BookingAttempt } from "~/booking/booking-attempt";
import { resolveBookingAttempt } from "~/booking/booking-attempt";
import { formatTimelineDay, formatTimelineTime } from "~/booking/booking-domain";
import type { BookingExtensionActionData } from "~/booking/booking-extension-form-schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

function eligibleLegs(booking: BookingDetail) {
  return booking.legs.filter((leg) => leg.canExtend && leg.maxExtendableHours > 0);
}

function legLabel(leg: BookingDetailLeg) {
  return `${formatTimelineDay(leg.legDate)} · ends ${formatTimelineTime(leg.legEndTime)}`;
}

function ExtensionForm({
  actionData,
  booking,
  idempotencyKey,
}: {
  readonly actionData?: BookingExtensionActionData;
  readonly booking: BookingDetail;
  readonly idempotencyKey: string;
}) {
  const legs = eligibleLegs(booking);
  const [bookingLegId, setBookingLegId] = useState(legs[0]?.id ?? "");
  const [hours, setHours] = useState("1");
  const idempotencyKeyRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<BookingAttempt | null>(null);
  const navigation = useNavigation();
  const isSubmitting = navigation.formMethod === "POST";
  const selectedLeg = legs.find((leg) => leg.id === bookingLegId) ?? legs[0];

  if (!selectedLeg) {
    return null;
  }

  return (
    <Form
      method="post"
      className="space-y-6"
      onSubmitCapture={(event) => {
        if (idempotencyKeyRef.current) {
          attemptRef.current = resolveBookingAttempt(
            attemptRef.current,
            new FormData(event.currentTarget),
          );
          idempotencyKeyRef.current.value = attemptRef.current.key;
        }
      }}
    >
      <input
        ref={idempotencyKeyRef}
        type="hidden"
        name="idempotencyKey"
        defaultValue={idempotencyKey}
      />

      {legs.length > 1 ? (
        <Field data-invalid={Boolean(actionData?.fieldErrors?.bookingLegId)}>
          <FieldLabel htmlFor="extension-booking-leg">Booking day</FieldLabel>
          <Select
            name="bookingLegId"
            value={bookingLegId}
            onValueChange={(value) => {
              setBookingLegId(value);
              setHours("1");
            }}
          >
            <SelectTrigger
              id="extension-booking-leg"
              className="h-10 w-full"
              aria-invalid={Boolean(actionData?.fieldErrors?.bookingLegId)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {legs.map((leg) => (
                <SelectItem key={leg.id} value={leg.id}>
                  {legLabel(leg)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{actionData?.fieldErrors?.bookingLegId?.join(", ")}</FieldError>
        </Field>
      ) : (
        <input type="hidden" name="bookingLegId" value={selectedLeg.id} />
      )}

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Current drop-off</p>
          <p className="mt-1 font-medium">{formatTimelineTime(selectedLeg.legEndTime)}</p>
          <p className="text-sm text-muted-foreground">{formatTimelineDay(selectedLeg.legDate)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Available extension</p>
          <p className="mt-1 font-medium">
            Up to {selectedLeg.maxExtendableHours}{" "}
            {selectedLeg.maxExtendableHours === 1 ? "hour" : "hours"}
          </p>
          <p className="text-sm text-muted-foreground">Availability is held during payment.</p>
        </div>
      </div>

      <Field data-invalid={Boolean(actionData?.fieldErrors?.hours)}>
        <FieldLabel htmlFor="extension-hours">Extension length</FieldLabel>
        <Select name="hours" value={hours} onValueChange={setHours}>
          <SelectTrigger
            id="extension-hours"
            className="h-10 w-full"
            aria-invalid={Boolean(actionData?.fieldErrors?.hours)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: selectedLeg.maxExtendableHours }, (_, index) => index + 1).map(
              (hour) => (
                <SelectItem key={hour} value={String(hour)}>
                  {hour} {hour === 1 ? "hour" : "hours"}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <FieldDescription>
          Availability is checked again before reserving the extension.
        </FieldDescription>
        <FieldError>{actionData?.fieldErrors?.hours?.join(", ")}</FieldError>
      </Field>

      {actionData?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to extend this trip</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>The final amount will be shown on the secure payment page before you pay.</p>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="animate-spin motion-reduce:animate-none">
                <Loader2 aria-hidden="true" />
              </span>
              Reserving extension…
            </>
          ) : (
            "Continue to payment"
          )}
        </Button>
      </div>
    </Form>
  );
}

export function BookingExtensionPage({
  actionData,
  booking,
  idempotencyKey,
}: {
  readonly actionData?: BookingExtensionActionData;
  readonly booking: BookingDetail;
  readonly idempotencyKey: string;
}) {
  const legs = eligibleLegs(booking);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <Link
        to={`/bookings/${encodeURIComponent(booking.id)}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to booking
      </Link>

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Clock3 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance font-heading text-xl leading-snug font-medium">
                Extend Trip
              </h1>
              <CardDescription className="mt-1">
                {booking.car.make} {booking.car.model} ({booking.car.year}) ·{" "}
                <span translate="no">{booking.bookingReference}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {legs.length > 0 ? (
            <ExtensionForm
              key={idempotencyKey}
              actionData={actionData}
              booking={booking}
              idempotencyKey={idempotencyKey}
            />
          ) : (
            <div className="space-y-4 py-4 text-center">
              <div>
                <h2 className="font-semibold">No extension is available</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This trip has no booking day that can be extended right now.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to={`/bookings/${encodeURIComponent(booking.id)}`}>View booking</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
