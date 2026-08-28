import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import { AddressAutocomplete } from "~/booking/address-autocomplete";
import { BookingTimeSelect } from "~/booking/booking-time-select";
import { normalizePickupTime } from "~/booking/pickup";
import { DAY_BOOKING_TYPE, FULL_DAY_BOOKING_TYPE } from "~/booking/types";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { SERVICE_TIMEZONE } from "~/time/timezone";

export type BookingModifyFieldErrors = Partial<
  Record<"pickupTime" | "pickupAddress" | "sameLocation" | "dropOffAddress", string[]>
>;

export type BookingModifyActionData = {
  error?: string;
  fieldErrors?: BookingModifyFieldErrors;
  ok?: true;
  revalidate?: false;
};

const pickupTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const cutoffFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(formatter: Intl.DateTimeFormat, value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

function FieldError({
  errors,
  id,
}: {
  readonly errors: readonly string[] | undefined;
  readonly id: string;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-red-600" role="alert">
      {errors.join(", ")}
    </p>
  );
}

function BookingModifyFields({
  booking,
  hasEditablePickupTime,
  initialPickupTime,
  pickupTime,
  setPickupTime,
  pickupAddress,
  setPickupAddress,
  sameLocation,
  setSameLocation,
  dropOffAddress,
  setDropOffAddress,
  errors,
}: {
  readonly booking: Pick<BookingDetail, "startDate" | "type">;
  readonly hasEditablePickupTime: boolean;
  readonly initialPickupTime: string;
  readonly pickupTime: string;
  readonly setPickupTime: (value: string) => void;
  readonly pickupAddress: string;
  readonly setPickupAddress: (value: string) => void;
  readonly sameLocation: boolean;
  readonly setSameLocation: (value: boolean) => void;
  readonly dropOffAddress: string;
  readonly setDropOffAddress: (value: string) => void;
  readonly errors: BookingModifyFieldErrors | undefined;
}) {
  return (
    <>
      <input type="hidden" name="pickupAddress" value={pickupAddress} />
      <input type="hidden" name="sameLocation" value={String(sameLocation)} />

      {hasEditablePickupTime ? (
        <>
          {pickupTime === initialPickupTime ? null : (
            <input type="hidden" name="pickupTime" value={pickupTime} />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="modify-pickup-time">Pickup time</Label>
            <BookingTimeSelect
              id="modify-pickup-time"
              date={new Date(booking.startDate)}
              bookingType={booking.type}
              value={pickupTime}
              onValueChange={setPickupTime}
              contentClassName="z-70"
              aria-invalid={Boolean(errors?.pickupTime)}
              aria-describedby={errors?.pickupTime ? "modify-pickup-time-error" : undefined}
            />
            <FieldError id="modify-pickup-time-error" errors={errors?.pickupTime} />
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="modify-pickup-address">Pickup address</Label>
        <AddressAutocomplete
          id="modify-pickup-address"
          value={pickupAddress}
          onSelect={setPickupAddress}
          onValueChange={() => setPickupAddress("")}
          placeholder="Enter pickup address"
          aria-invalid={Boolean(errors?.pickupAddress)}
          aria-describedby={errors?.pickupAddress ? "modify-pickup-address-error" : undefined}
        />
        <FieldError id="modify-pickup-address-error" errors={errors?.pickupAddress} />
      </div>

      <div className="flex items-center gap-2 py-1">
        <Checkbox
          id="modify-same-location"
          checked={sameLocation}
          onCheckedChange={(checked) => {
            const nextSameLocation = checked === true;
            setSameLocation(nextSameLocation);
            if (nextSameLocation) {
              setDropOffAddress("");
            }
          }}
          aria-invalid={Boolean(errors?.sameLocation)}
          aria-describedby={errors?.sameLocation ? "modify-same-location-error" : undefined}
        />
        <Label htmlFor="modify-same-location" className="font-normal">
          Drop-off location same as pickup
        </Label>
      </div>
      <FieldError id="modify-same-location-error" errors={errors?.sameLocation} />

      {sameLocation ? null : (
        <>
          <input type="hidden" name="dropOffAddress" value={dropOffAddress} />
          <div className="space-y-1.5">
            <Label htmlFor="modify-drop-off-address">Drop-off address</Label>
            <AddressAutocomplete
              id="modify-drop-off-address"
              value={dropOffAddress}
              onSelect={setDropOffAddress}
              onValueChange={() => setDropOffAddress("")}
              placeholder="Enter drop-off address"
              aria-invalid={Boolean(errors?.dropOffAddress)}
              aria-describedby={
                errors?.dropOffAddress ? "modify-drop-off-address-error" : undefined
              }
            />
            <FieldError id="modify-drop-off-address-error" errors={errors?.dropOffAddress} />
          </div>
        </>
      )}
    </>
  );
}

export function BookingModifyCard({
  booking,
}: {
  readonly booking: Pick<
    BookingDetail,
    "startDate" | "type" | "pickupLocation" | "returnLocation" | "modificationCutoffAt"
  >;
}) {
  const fetcher = useFetcher<BookingModifyActionData>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const initialPickupTime =
    normalizePickupTime(formatDate(pickupTimeFormatter, booking.startDate)) ?? "";
  const [pickupTime, setPickupTime] = useState(
    () => normalizePickupTime(formatDate(pickupTimeFormatter, booking.startDate)) ?? "",
  );
  const [pickupAddress, setPickupAddress] = useState(booking.pickupLocation);
  const [sameLocation, setSameLocation] = useState(
    booking.pickupLocation === booking.returnLocation,
  );
  const [dropOffAddress, setDropOffAddress] = useState(
    booking.pickupLocation === booking.returnLocation ? "" : booking.returnLocation,
  );
  const isSaving = fetcher.state !== "idle";
  const actionData = fetcher.state === "idle" ? fetcher.data : undefined;
  const hasEditablePickupTime =
    booking.type === DAY_BOOKING_TYPE || booking.type === FULL_DAY_BOOKING_TYPE;
  const cutoff = formatDate(cutoffFormatter, booking.modificationCutoffAt);
  const showDialog = dialogOpen && actionData?.ok !== true;
  const errors = actionData?.fieldErrors;

  function openDialog() {
    if (isSaving) {
      return;
    }

    const locationsMatch = booking.pickupLocation === booking.returnLocation;
    fetcher.reset();
    setPickupTime(initialPickupTime);
    setPickupAddress(booking.pickupLocation);
    setSameLocation(locationsMatch);
    setDropOffAddress(locationsMatch ? "" : booking.returnLocation);
    setDialogOpen(true);
  }

  return (
    <section className="rounded border bg-card text-card-foreground shadow-sm">
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Modify booking</h2>
          <p className="text-sm text-muted-foreground">
            Change your pickup and drop-off details{cutoff ? ` until ${cutoff}` : ""}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isSaving}
          onClick={openDialog}
        >
          Modify Booking
        </Button>
        {actionData?.ok ? (
          <output className="text-sm text-green-700">Booking updated successfully.</output>
        ) : null}
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(nextOpen) => {
          if (!isSaving) {
            setDialogOpen(nextOpen);
          }
        }}
      >
        <DialogContent
          showCloseButton={!isSaving}
          overlayClassName="z-60"
          className="z-60 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain p-6 sm:max-w-106.25"
        >
          <DialogHeader>
            <DialogTitle>Modify Booking</DialogTitle>
            <DialogDescription>
              {hasEditablePickupTime
                ? "Edit the pickup time and location details for this booking."
                : "Edit the pickup and drop-off locations for this booking."}
            </DialogDescription>
          </DialogHeader>

          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="modify" />

            {actionData?.error ? (
              <p className="text-sm text-red-600" role="alert">
                {actionData.error}
              </p>
            ) : null}

            <BookingModifyFields
              booking={booking}
              hasEditablePickupTime={hasEditablePickupTime}
              initialPickupTime={initialPickupTime}
              pickupTime={pickupTime}
              setPickupTime={setPickupTime}
              pickupAddress={pickupAddress}
              setPickupAddress={setPickupAddress}
              sameLocation={sameLocation}
              setSameLocation={setSameLocation}
              dropOffAddress={dropOffAddress}
              setDropOffAddress={setDropOffAddress}
              errors={errors}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => setDialogOpen(false)}
              >
                Close
              </Button>
              <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? (
                  <>
                    <span className="inline-flex animate-spin motion-reduce:animate-none">
                      <Loader2 className="size-4" aria-hidden="true" />
                    </span>
                    {" Saving…"}
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
