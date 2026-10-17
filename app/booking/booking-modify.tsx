import { Loader2, Pencil } from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
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

type BookingModifyState = {
  readonly dialogOpen: boolean;
  readonly pickupTime: string;
  readonly pickupAddress: string;
  readonly sameLocation: boolean;
  readonly dropOffAddress: string;
};

const pickupTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const fieldControlClassName = "h-10 w-full rounded-sm shadow-none";

function formatDate(formatter: Intl.DateTimeFormat, value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
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
  now,
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
  readonly now: Date;
}) {
  return (
    <FieldGroup>
      <input type="hidden" name="pickupAddress" value={pickupAddress} />
      <input type="hidden" name="sameLocation" value={String(sameLocation)} />

      {hasEditablePickupTime ? (
        <Field data-invalid={Boolean(errors?.pickupTime)}>
          {pickupTime === initialPickupTime ? null : (
            <input type="hidden" name="pickupTime" value={pickupTime} />
          )}
          <FieldLabel htmlFor="modify-pickup-time">Pickup Time</FieldLabel>
          <BookingTimeSelect
            id="modify-pickup-time"
            date={new Date(booking.startDate)}
            bookingType={booking.type}
            value={pickupTime}
            onValueChange={setPickupTime}
            className={`${fieldControlClassName} data-[size=default]:h-10 data-[size=default]:rounded-sm`}
            contentClassName="z-70"
            now={now}
            aria-invalid={Boolean(errors?.pickupTime)}
            aria-describedby={errors?.pickupTime ? "modify-pickup-time-error" : undefined}
          />
          <FieldError id="modify-pickup-time-error" errors={errors?.pickupTime} />
        </Field>
      ) : null}

      <Field data-invalid={Boolean(errors?.pickupAddress)}>
        <FieldLabel htmlFor="modify-pickup-address">Pickup Address</FieldLabel>
        <AddressAutocomplete
          id="modify-pickup-address"
          value={pickupAddress}
          onSelect={setPickupAddress}
          onValueChange={() => setPickupAddress("")}
          placeholder="Enter pickup address"
          className={fieldControlClassName}
          contentClassName="z-70"
          aria-invalid={Boolean(errors?.pickupAddress)}
          aria-describedby={errors?.pickupAddress ? "modify-pickup-address-error" : undefined}
        />
        <FieldError id="modify-pickup-address-error" errors={errors?.pickupAddress} />
      </Field>

      <Field data-invalid={Boolean(errors?.sameLocation)}>
        <div className="flex items-center gap-2">
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
          <FieldLabel htmlFor="modify-same-location">Use the same address for drop-off</FieldLabel>
        </div>
        <FieldError id="modify-same-location-error" errors={errors?.sameLocation} />
      </Field>

      {sameLocation ? null : (
        <Field data-invalid={Boolean(errors?.dropOffAddress)}>
          <input type="hidden" name="dropOffAddress" value={dropOffAddress} />
          <FieldLabel htmlFor="modify-drop-off-address">Drop-off Address</FieldLabel>
          <AddressAutocomplete
            id="modify-drop-off-address"
            value={dropOffAddress}
            onSelect={setDropOffAddress}
            onValueChange={() => setDropOffAddress("")}
            placeholder="Enter drop-off address"
            className={fieldControlClassName}
            contentClassName="z-70"
            aria-invalid={Boolean(errors?.dropOffAddress)}
            aria-describedby={errors?.dropOffAddress ? "modify-drop-off-address-error" : undefined}
          />
          <FieldError id="modify-drop-off-address-error" errors={errors?.dropOffAddress} />
        </Field>
      )}
    </FieldGroup>
  );
}

export function BookingModifyCard({
  booking,
  now,
}: {
  readonly booking: Pick<BookingDetail, "startDate" | "type" | "pickupLocation" | "returnLocation">;
  readonly now: string;
}) {
  const clock = new Date(now);
  const fetcher = useFetcher<BookingModifyActionData>();
  const initialPickupTime =
    normalizePickupTime(formatDate(pickupTimeFormatter, booking.startDate)) ?? "";
  const locationsMatch = booking.pickupLocation === booking.returnLocation;
  const [state, setState] = useState<BookingModifyState>(() => ({
    dialogOpen: false,
    pickupTime: initialPickupTime,
    pickupAddress: booking.pickupLocation,
    sameLocation: locationsMatch,
    dropOffAddress: locationsMatch ? "" : booking.returnLocation,
  }));
  const isSaving = fetcher.state !== "idle";
  const actionData = fetcher.state === "idle" ? fetcher.data : undefined;
  const hasEditablePickupTime =
    booking.type === DAY_BOOKING_TYPE || booking.type === FULL_DAY_BOOKING_TYPE;
  const showDialog = state.dialogOpen && actionData?.ok !== true;
  const errors = actionData?.fieldErrors;

  function openDialog() {
    if (isSaving) {
      return;
    }

    fetcher.reset();
    setState({
      dialogOpen: true,
      pickupTime: initialPickupTime,
      pickupAddress: booking.pickupLocation,
      sameLocation: locationsMatch,
      dropOffAddress: locationsMatch ? "" : booking.returnLocation,
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        className="h-12 rounded-md px-4 shadow-sm"
        disabled={isSaving}
        onClick={openDialog}
      >
        <Pencil aria-hidden="true" />
        Edit Booking
      </Button>
      {actionData?.ok ? (
        <output className="text-sm text-green-700">Booking updated successfully.</output>
      ) : null}

      <Dialog
        open={showDialog}
        onOpenChange={(nextOpen) => {
          if (!isSaving) {
            setState((current) => ({ ...current, dialogOpen: nextOpen }));
          }
        }}
      >
        <DialogContent
          showCloseButton={!isSaving}
          overlayClassName="z-60 bg-[rgba(41,41,58,0.45)]"
          closeClassName="top-6 right-6 flex size-8 items-center justify-center rounded-2xl border border-gray-200 bg-white p-1 text-gray-900 opacity-100 hover:opacity-80 sm:right-8"
          className="z-60 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-10 overflow-y-auto overscroll-contain rounded-lg bg-white p-6 text-gray-900 shadow-lg ring-0 sm:max-w-[528px] sm:px-8"
        >
          <DialogHeader className="gap-0.5 text-left">
            <DialogTitle className="text-xl leading-7 font-semibold text-gray-900 sm:text-2xl sm:leading-8">
              Edit Booking
            </DialogTitle>
            <DialogDescription className="text-sm leading-5 text-gray-600">
              {hasEditablePickupTime
                ? "Update your pickup time and location. Changes aren’t allowed once your booking is active."
                : "Update your pickup and drop-off locations. Changes aren’t allowed once your booking is active."}
            </DialogDescription>
          </DialogHeader>

          <fetcher.Form method="post" className="flex flex-col gap-5">
            <input type="hidden" name="intent" value="modify" />

            {actionData?.error ? (
              <p className="text-sm text-destructive" role="alert">
                {actionData.error}
              </p>
            ) : null}

            <BookingModifyFields
              booking={booking}
              hasEditablePickupTime={hasEditablePickupTime}
              initialPickupTime={initialPickupTime}
              pickupTime={state.pickupTime}
              setPickupTime={(pickupTime) => setState((current) => ({ ...current, pickupTime }))}
              pickupAddress={state.pickupAddress}
              setPickupAddress={(pickupAddress) =>
                setState((current) => ({ ...current, pickupAddress }))
              }
              sameLocation={state.sameLocation}
              setSameLocation={(sameLocation) =>
                setState((current) => ({ ...current, sameLocation }))
              }
              dropOffAddress={state.dropOffAddress}
              setDropOffAddress={(dropOffAddress) =>
                setState((current) => ({ ...current, dropOffAddress }))
              }
              errors={errors}
              now={clock}
            />

            <DialogFooter className="mx-0 mb-0 flex-col gap-4 rounded-none border-0 bg-transparent p-0 sm:flex-col">
              <Button
                type="submit"
                disabled={isSaving}
                aria-busy={isSaving}
                className="h-12 w-full rounded-md"
              >
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
              <Button
                type="button"
                variant="secondary"
                disabled={isSaving}
                className="h-12 w-full rounded-md border-gray-100 bg-gray-100 text-gray-900 hover:bg-gray-200"
                onClick={() => setState((current) => ({ ...current, dialogOpen: false }))}
              >
                Cancel
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
