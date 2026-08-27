import { getFormProps, type SubmissionResult, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { type ReactNode, useRef } from "react";
import { Form, useLocation, useNavigation } from "react-router";

import type { BookingPricingPreview } from "~/api/bookings/schema";
import type { TripDurationResponse } from "~/api/flights/schema";
import { authPath } from "~/auth/referer";
import { usePublicUser } from "~/auth/use-public-user";
import { type BookingAttempt, resolveBookingAttempt } from "~/booking/booking-attempt";
import { createBookingFormSchema } from "~/booking/booking-create-form-schema";
import { BookingGuestFields } from "~/booking/booking-guest-fields";
import { type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { CarBookingCheckout } from "~/car/car-booking-checkout";

function isCarBookingSubmit(formAction: string | undefined) {
  if (!formAction) {
    return false;
  }

  const path = new URL(formAction, "https://tripdly.com").pathname;
  return path.startsWith("/cars/") || path.startsWith("/__visual/car");
}

export function CarBookingPayForm({
  carId,
  bookingType,
  from,
  to,
  pickupTime,
  flightNumber,
  pickupAddress,
  dropOffAddress,
  sameLocation,
  preview,
  pricingError,
  isPricingLoading,
  lastResult,
  price,
  schedule,
  tripArrivalTime,
  tripDuration,
}: {
  readonly carId: string;
  readonly bookingType: BookingType;
  readonly from: string;
  readonly to: string;
  readonly pickupTime: string;
  readonly flightNumber: string;
  readonly pickupAddress: string;
  readonly dropOffAddress: string;
  readonly sameLocation: boolean;
  readonly preview: BookingPricingPreview | null;
  readonly pricingError: string | null;
  readonly isPricingLoading: boolean;
  readonly lastResult?: SubmissionResult<string[]>;
  readonly price: ReactNode;
  readonly schedule: ReactNode;
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
}) {
  const location = useLocation();
  const navigation = useNavigation();
  const isSignedIn = usePublicUser() != null;
  const schema = createBookingFormSchema(!isSignedIn);
  const idempotencyKeyRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<BookingAttempt | null>(null);
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const isPaying = navigation.formMethod === "POST" && isCarBookingSubmit(navigation.formAction);
  const hasResolvedAddresses =
    pickupAddress.trim().length > 0 && (sameLocation || dropOffAddress.trim().length > 0);
  const isPricingReady = preview != null && !isPricingLoading && pricingError == null;
  const canPay = isPricingReady && hasResolvedAddresses;
  const bookingErrors = [
    ...(fields.carId.errors ?? []),
    ...(fields.idempotencyKey.errors ?? []),
    ...(fields.expectedTotalAmount.errors ?? []),
    ...(fields.bookingType.errors ?? []),
    ...(fields.from.errors ?? []),
    ...(fields.to.errors ?? []),
    ...(fields.pickupTime.errors ?? []),
    ...(fields.flightNumber.errors ?? []),
    ...(fields.pickupAddress.errors ?? []),
    ...(fields.dropOffAddress?.errors ?? []),
    ...(fields.sameLocation.errors ?? []),
    ...(fields.name?.errors ?? []),
    ...(fields.email?.errors ?? []),
    ...(fields.phoneNumber?.errors ?? []),
    ...(form.errors ?? []),
  ];

  return (
    <Form
      method="post"
      action={`${location.pathname}${location.search}`}
      {...getFormProps(form)}
      className="contents"
      onSubmitCapture={(event) => {
        if (!canPay) {
          event.preventDefault();
          return;
        }

        if (idempotencyKeyRef.current) {
          attemptRef.current = resolveBookingAttempt(
            attemptRef.current,
            new FormData(event.currentTarget),
          );
          idempotencyKeyRef.current.value = attemptRef.current.key;
        }
      }}
    >
      <input type="hidden" name="carId" value={carId} />
      <input ref={idempotencyKeyRef} type="hidden" name="idempotencyKey" />
      <input
        type="hidden"
        name="expectedTotalAmount"
        value={preview ? String(preview.totalAmount) : ""}
      />
      <input type="hidden" name="bookingType" value={bookingType} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input
        type="hidden"
        name="pickupTime"
        value={bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : pickupTime}
      />
      <input type="hidden" name="flightNumber" value={flightNumber} />
      <input type="hidden" name="pickupAddress" value={pickupAddress} />
      <input type="hidden" name="dropOffAddress" value={dropOffAddress} />
      <input type="hidden" name="sameLocation" value={sameLocation ? "true" : "false"} />
      {bookingErrors.length > 0 ? (
        <span id={form.errorId} className="sr-only">
          {bookingErrors.join(" ")}
        </span>
      ) : null}

      <CarBookingCheckout
        price={price}
        schedule={schedule}
        tripArrivalTime={tripArrivalTime}
        tripDuration={tripDuration}
        bookingType={bookingType}
        checkout={{
          guest: isSignedIn ? null : (
            <BookingGuestFields
              fields={{
                name: fields.name,
                email: fields.email,
                phoneNumber: fields.phoneNumber,
              }}
            />
          ),
          preview,
          pricingError,
          isPricingLoading,
          canPay,
          errorId: form.errorId,
          bookingErrors,
          isPaying,
          isSignedIn,
          signInHref: authPath("/auth", {
            redirectTo: `${location.pathname}${location.search}`,
          }),
        }}
      />
    </Form>
  );
}
