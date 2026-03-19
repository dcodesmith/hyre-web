import { type FieldMetadata, getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { Car, User } from "@prisma/client";
import { Link, useFetcher, useNavigate, useNavigation, useSearchParams } from "@remix-run/react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isAfter,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { Form } from "~/components/CSRFForm";
import {
  calculateBookingUnits,
  isValidToDateSelection,
  getToDateMinDate,
} from "~/lib/booking-utils";
import { cn, formatCurrency } from "~/lib/utils";
import {
  BOOKING_TYPE_LABELS,
  BOOKING_TYPE_OPTIONS,
  BOOKING_TYPE_OPTIONS_MAP,
  BookingType,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  AIRPORT_PICKUP_BOOKING_TYPE,
  TAB_VALUE_TO_BOOKING_TYPE,
} from "../bookingTypes";
import { BookingTypeTabs } from "../BookingTypeTabs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { BookingActions } from "./BookingActions";
import { BookingAddons } from "./BookingAddons";
import { BookingCostBreakdown } from "./BookingCostBreakdown";
import { BookingFormFields } from "./BookingFormFields";
import { GuestDetails } from "./GuestDetails";
import { SingleDatePicker } from "./SingleDatePicker";
import { TripDetails } from "./TripDetails";
import { getOrdinal } from "./helpers";
import { getBookingSchema } from "~/schemas/booking.schema";
import { useBookingFlight } from "~/hooks/useBookingFlight";
import { useBookingPricing, useFinalPricing } from "~/hooks/useBookingPricing";
import { useIsMobile } from "~/hooks/use-mobile";
import { useReferralCredits } from "~/hooks/useReferralCredits";

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

// Type guard for BookingType validation - defined outside component to avoid recreation
const isValidBookingType = (value: string | null): value is BookingType =>
  !!value && BOOKING_TYPE_OPTIONS.includes(value as BookingType);

// Default pickup time helper - defined outside to avoid recreation
const getDefaultPickupTime = (
  bookingType: BookingType,
  searchParams: URLSearchParams,
): string | undefined => {
  if (bookingType === NIGHT_BOOKING_TYPE) return "11:00 PM";
  return searchParams.get("pickupTime") || undefined;
};

type BookingCardProps = {
  readonly car: Car & { fuelUpgradeRate: number | null; pricingIncludesFuel: boolean };
  readonly isAvailable: boolean;
  readonly user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  readonly vatRate: number;
  readonly platformServiceFeeRate: number;
  readonly securityDetailRate: number;
};

interface BookingCredits {
  availableCredits: number;
  totalEarned: number;
  maxCreditsPerBooking: number;
}

type GuestFieldsData = {
  nameField: FieldMetadata<string>;
  emailField: FieldMetadata<string>;
  phoneNumberField: FieldMetadata<string>;
};

function GuestDetailsPlacement({
  guestFields,
  errorRingClasses,
  className,
  showHeading,
  variant,
}: {
  readonly guestFields: GuestFieldsData | null;
  readonly errorRingClasses: string;
  readonly className: string;
  readonly showHeading?: boolean;
  readonly variant: "mobile" | "desktop";
}) {
  const isMobile = useIsMobile();
  const shouldRender = variant === "mobile" ? isMobile : !isMobile;

  if (!guestFields || !shouldRender) return null;

  return (
    <div className={className}>
      {showHeading && <h3 className="text-sm font-semibold mb-2">Guest Details</h3>}
      <GuestDetails
        fields={{
          name: guestFields.nameField,
          email: guestFields.emailField,
          phoneNumber: guestFields.phoneNumberField,
        }}
        errorRingClasses={errorRingClasses}
      />
    </div>
  );
}

function BookingActionsPlacement({
  user,
  isPending,
  onNavigateToAuth,
}: {
  readonly user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  readonly isPending: boolean;
  readonly onNavigateToAuth: () => void;
}) {
  if (user?.roles?.some((role) => ["fleetOwner", "admin", "staff"].includes(role.name))) {
    return null;
  }

  return (
    <BookingActions user={user} isPending={isPending} onNavigateToAuth={onNavigateToAuth} />
  );
}

export default function BookingCard({
  car,
  isAvailable = false,
  user,
  vatRate,
  platformServiceFeeRate,
}: BookingCardProps) {
  const navigate = useNavigate();
  const csrfToken = useAuthenticityToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingFetcher = useFetcher<{ error?: string; success?: boolean }>();
  const [showFetcherError, setShowFetcherError] = useState(true);

  const bookingTypeParam = searchParams.get("bookingType");
  const hasValidBookingType = isValidBookingType(bookingTypeParam);

  const bookingType: BookingType = hasValidBookingType ? bookingTypeParam : DAY_BOOKING_TYPE;

  const navigation = useNavigation();
  const isPending =
    (navigation.state === "submitting" && navigation.formMethod === "POST") ||
    bookingFetcher.state !== "idle";

  const [sameLocationChecked, setSameLocationChecked] = useState<boolean>(
    searchParams.get("sameLocation") !== "false",
  );
  const [requiresFullTank, setRequiresFullTank] = useState(false);
  const fallbackDateRef = useRef<Date>(startOfDay(new Date()));

  // Flight validation hook for booking flow
  const {
    validatedFlight,
    setValidatedFlight,
    tripDuration,
    processedFlightRef,
    handleDropOffAddressSelected,
    clearFlightState,
  } = useBookingFlight({ bookingType, searchParams });
  const tripDetailsArrivalTime =
    validatedFlight?.estimatedArrival ??
    validatedFlight?.actualArrival ??
    validatedFlight?.scheduledArrival;

  // Date range parsing
  const initialDateRange = useMemo(() => {
    const parseDateParam = (param: string | null) => {
      if (!param) return undefined;
      try {
        const date = parseISO(param);
        if (Number.isNaN(date.getTime())) {
          console.warn("Invalid date parameter:", param);
          return undefined;
        }
        return date;
      } catch (e) {
        console.error("Error parsing date param:", e);
        return undefined;
      }
    };

    const fromDate = parseDateParam(searchParams.get("from"));
    const toDate = parseDateParam(searchParams.get("to"));

    if (fromDate && toDate && isAfter(fromDate, toDate)) {
      console.warn("'from' date is after 'to' date, resetting range.");
      return { from: undefined, to: undefined };
    }

    return { from: fromDate, to: toDate };
  }, [searchParams]);

  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);

  const totalDays = useMemo(
    () => calculateBookingUnits(dateRange.from, dateRange.to, bookingType),
    [dateRange.from, dateRange.to, bookingType],
  );

  // Base pricing hook (before discounts)
  const {
    currentCarPrice,
    baseTotal,
    fuelUpgradeCost,
    platformFee,
    fuelNote,
    subtotalBeforeDiscounts,
  } = useBookingPricing({
    car,
    bookingType,
    totalDays,
    requiresFullTank,
    platformServiceFeeRate,
  });

  const carIsAvailableToBook = useMemo(
    () => !!dateRange.from && !!dateRange.to && totalDays > 0 && isAvailable,
    [dateRange.from, dateRange.to, totalDays, isAvailable],
  );

  // Referral and credits hook
  const { referralDiscount, bookingCredits, useCreditsAmount, handleUseCreditsChange } =
    useReferralCredits({
      user,
      carIsAvailableToBook,
      subtotalBeforeDiscounts,
      bookingType,
    });

  // Calculate referral discount amount
  const referralDiscountAmount = useMemo(() => {
    if (!user || !referralDiscount?.eligible) return 0;
    return Math.min(referralDiscount.discountAmount || 0, subtotalBeforeDiscounts);
  }, [user, referralDiscount, subtotalBeforeDiscounts]);

  // Final pricing hook (after discounts)
  const { vat, finalTotalCost } = useFinalPricing({
    subtotalBeforeDiscounts,
    referralDiscountAmount,
    useCreditsAmount,
    vatRate,
  });

  // Compute default pickup time based on booking type
  const defaultPickupTime = useMemo(
    () => getDefaultPickupTime(bookingType, searchParams),
    [bookingType, searchParams],
  );

  const [form, fields] = useForm({
    id: `booking-form-${car.id}`,
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      carId: car.id,
      pickupTime: defaultPickupTime,
      flightNumber:
        bookingType === AIRPORT_PICKUP_BOOKING_TYPE
          ? searchParams.get("flightNumber") || undefined
          : undefined,
      pickupAddress: searchParams.get("pickupAddress") || undefined,
      dropOffAddress: searchParams.get("dropOffAddress") || undefined,
      sameLocation: sameLocationChecked ? "true" : "false",
      bookingType,
      // Only include guest fields if user is not logged in
      ...(user
        ? {}
        : {
            email: searchParams.get("email") ?? "",
            name: searchParams.get("name") ?? "",
            phoneNumber: searchParams.get("phoneNumber") ?? "",
          }),
    },
    onValidate({ formData }) {
      const intent = formData.get("intent") as "guest" | "auth" | null;
      const isGuest = intent === "guest";
      const schema = getBookingSchema(isGuest);
      return parseWithZod(formData, { schema });
    },
    onSubmit(event, { formData }) {
      event.preventDefault();

      const submissionIntent = formData.get("intent") as "guest" | "auth";

      if (submissionIntent === "auth" && !user) {
        const currentParams = new URLSearchParams(searchParams);

        formData.forEach((value, key) => {
          if (
            typeof value === "string" &&
            value &&
            (bookingType === AIRPORT_PICKUP_BOOKING_TYPE
              ? ["flightNumber", "pickupAddress", "dropOffAddress"].includes(key)
              : ["pickupTime", "pickupAddress", "dropOffAddress"].includes(key))
          ) {
            currentParams.set(key, value);
          }
        });

        if (dateRange.from) {
          currentParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
        } else {
          currentParams.delete("from");
        }

        if (dateRange.to) {
          currentParams.set("to", format(dateRange.to, "yyyy-MM-dd"));
        } else {
          currentParams.delete("to");
        }

        currentParams.set("sameLocation", sameLocationChecked ? "true" : "false");
        currentParams.set("bookingType", bookingType);

        currentParams.set("requiresFullTank", String(requiresFullTank));
        const redirectTo = `/cars/${car.id}?${currentParams.toString()}`;

        return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      formData.append("csrf", csrfToken);
      bookingFetcher.submit(formData, {
        method: "POST",
        action: `/bookings?${searchParams.toString()}`,
      });
    },
  });

  const handleFromDateChange = useCallback(
    (date: Date | undefined) => {
      const normalizedFrom = date ? startOfDay(date) : undefined;

      // For airport pickup, automatically set "to" to same as "from"
      if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
        setDateRange({ from: normalizedFrom, to: normalizedFrom });
        const newSearchParams = new URLSearchParams(searchParams);

        if (normalizedFrom) {
          newSearchParams.set("from", format(normalizedFrom, "yyyy-MM-dd"));
          // Set to same as from for airport pickup (required for calculateBookingUnits)
          newSearchParams.set("to", format(normalizedFrom, "yyyy-MM-dd"));
        } else {
          newSearchParams.delete("from");
          newSearchParams.delete("to");
        }

        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
        return;
      }

      // For other booking types, update "from" and clear "to" if it's before new "from"
      const newTo =
        dateRange.to && normalizedFrom && dateRange.to < normalizedFrom ? undefined : dateRange.to;

      setDateRange({ from: normalizedFrom, to: newTo });
      const newSearchParams = new URLSearchParams(searchParams);

      if (normalizedFrom) {
        newSearchParams.set("from", format(normalizedFrom, "yyyy-MM-dd"));
      } else {
        newSearchParams.delete("from");
      }

      if (newTo) {
        newSearchParams.set("to", format(newTo, "yyyy-MM-dd"));
      } else {
        newSearchParams.delete("to");
      }

      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    },
    [bookingType, dateRange.to, searchParams, setSearchParams],
  );

  // Calculate minDate for "To" date picker
  // For NIGHT/FULL_DAY bookings, prevent same-day selection by requiring at least 1 day after "from"
  const toDateMinDate = useMemo(
    () => getToDateMinDate(bookingType, dateRange.from),
    [bookingType, dateRange.from],
  );

  const handleToDateChange = useCallback(
    (date: Date | undefined) => {
      const normalizedTo = date ? startOfDay(date) : undefined;

      // Validate that "to" >= "from" (safety check, minDate should enforce this)
      if (dateRange.from && normalizedTo && isAfter(dateRange.from, normalizedTo)) {
        // If invalid, don't update
        return;
      }

      // For night and full day bookings, enforce that start and end dates must be different
      if (!isValidToDateSelection(bookingType, dateRange.from, normalizedTo)) {
        // If same day selected, don't allow the selection
        return;
      }

      setDateRange({ from: dateRange.from, to: normalizedTo });
      const newSearchParams = new URLSearchParams(searchParams);

      if (dateRange.from) {
        newSearchParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
      } else {
        newSearchParams.delete("from");
      }

      if (normalizedTo) {
        newSearchParams.set("to", format(normalizedTo, "yyyy-MM-dd"));
      } else {
        newSearchParams.delete("to");
      }

      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    },
    [bookingType, dateRange.from, searchParams, setSearchParams],
  );

  const handleSameLocationChange = useCallback(
    (checked: boolean) => {
      setSameLocationChecked(checked);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("sameLocation", checked ? "true" : "false");

      if (checked) {
        newSearchParams.delete("dropOffAddress");
      }

      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  const handlePickupTimeChange = useCallback(
    (value: string) => {
      if (value && (bookingType === DAY_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE)) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("pickupTime", value);
        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [bookingType, searchParams, setSearchParams],
  );

  const nightBookingHelperText = useMemo(() => {
    if (bookingType !== NIGHT_BOOKING_TYPE || !dateRange.from || !dateRange.to || totalDays <= 0) {
      return null;
    }

    const nights = totalDays;
    // For night bookings, only show the start dates (not the end date which is just the morning)
    // e.g., Oct 26 to Oct 27 = 1 night (the night of Oct 26), so only show "Oct 26th"

    const endForList =
      differenceInCalendarDays(dateRange.to, dateRange.from) > 0
        ? subDays(dateRange.to, 1)
        : dateRange.from;
    const daysArr = eachDayOfInterval({
      start: dateRange.from,
      end: endForList,
    });

    const daysStr = daysArr.map((d) => `${format(d, "MMM")} ${getOrdinal(d.getDate())}`).join(", ");
    return `All overnight bookings start at 11pm and end at 5am. Booking for ${nights} night${nights > 1 ? "s" : ""} (${daysStr}).`;
  }, [bookingType, dateRange.from, dateRange.to, totalDays]);

  const handleBookingTypeChange = useCallback(
    (tabValue: string) => {
      const newBookingType = TAB_VALUE_TO_BOOKING_TYPE[tabValue];
      if (newBookingType) {
        const newSearchParams = new URLSearchParams();
        newSearchParams.set("bookingType", newBookingType);

        // Reset URL state and all booking form state when changing booking type.
        setDateRange({ from: undefined, to: undefined });
        setSameLocationChecked(true);
        setRequiresFullTank(false);
        clearFlightState();
        setShowFetcherError(false);

        // Clear primary booking form fields to avoid stale values across booking types.
        form.update({ name: "pickupTime", value: "" });
        form.update({ name: "flightNumber", value: "" });
        form.update({ name: "pickupAddress", value: "" });
        form.update({ name: "dropOffAddress", value: "" });
        form.update({ name: "sameLocation", value: "true" });
        form.update({ name: "requiresFullTank", value: "false" });

        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [clearFlightState, form, setSearchParams],
  );

  const handleFullTankChange = useCallback((checked: boolean) => {
    setRequiresFullTank(!!checked);
  }, []);

  // Clear booking errors when form values change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally trigger on form value changes
  useEffect(() => {
    setShowFetcherError(false);
  }, [bookingType, dateRange.from, dateRange.to, validatedFlight]);

  // Show error when fetcher returns with new error data
  useEffect(() => {
    if (bookingFetcher.data?.error) {
      setShowFetcherError(true);
    }
  }, [bookingFetcher.data?.error]);

  // Handle validated flight - auto-fill pickup address with destination airport
  // biome-ignore lint/correctness/useExhaustiveDependencies: processedFlightRef is a stable ref that doesn't need to be in deps
  useEffect(() => {
    if (validatedFlight && bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
      // Check if we've already processed this flight to avoid infinite loop
      const flightId = validatedFlight.flightId;
      if (processedFlightRef.current === flightId) {
        return;
      }

      // Mark this flight as processed
      processedFlightRef.current = flightId;

      // Get airport name/code for pickup address
      const airportAddress = validatedFlight.arrivalAddress
        ? `${validatedFlight.arrivalAddress}`
        : validatedFlight.destination;

      // Update pickup address field
      form.update({ name: "pickupAddress", value: airportAddress });

      // Uncheck "same location" so drop-off field is shown
      setSameLocationChecked(false);

      // Update URL params
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("sameLocation", "false");
      newSearchParams.set("pickupAddress", airportAddress);
      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    } else {
      // Reset processed flight when there's no validated flight or booking type changes
      processedFlightRef.current = null;
    }
  }, [validatedFlight, bookingType, form, searchParams, setSearchParams]);

  // Update URL params with calculated pickup date and time for AIRPORT_PICKUP bookings
  useEffect(() => {
    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && tripDetailsArrivalTime && tripDuration) {
      const arrivalDate = new Date(tripDetailsArrivalTime);
      const pickupDateTime = new Date(arrivalDate.getTime() + 40 * 60 * 1000); // 40 min after arrival

      // Add 20% buffer to drive time
      const bufferedDriveMinutes = Math.ceil(tripDuration.durationInMinutes * 1.2);
      const dropOffDateTime = new Date(pickupDateTime.getTime() + bufferedDriveMinutes * 60 * 1000);

      // Format date as YYYY-MM-DD (like DAY/NIGHT/FULL_DAY bookings) using Lagos timezone
      const pickupDateOnly = formatInTimeZone(pickupDateTime, LAGOS_TIMEZONE, "yyyy-MM-dd");
      const dropOffDateOnly = formatInTimeZone(dropOffDateTime, LAGOS_TIMEZONE, "yyyy-MM-dd");

      // Format time as "H:MM AM/PM" in Lagos timezone (like DAY/NIGHT/FULL_DAY bookings)
      const pickupTimeFormatted = formatInTimeZone(
        pickupDateTime,
        LAGOS_TIMEZONE,
        "h:mm a",
      ).toUpperCase();

      // Update URL search params
      const newParams = new URLSearchParams(searchParams);
      newParams.set("from", pickupDateOnly);
      newParams.set("to", dropOffDateOnly);
      newParams.set("pickupTime", pickupTimeFormatted);

      // Only update if params have changed to avoid infinite loop
      if (
        newParams.get("from") !== searchParams.get("from") ||
        newParams.get("to") !== searchParams.get("to") ||
        newParams.get("pickupTime") !== searchParams.get("pickupTime")
      ) {
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [bookingType, tripDetailsArrivalTime, tripDuration, searchParams, setSearchParams]);

  // Get guest fields when user is not logged in
  const guestFields = useMemo(() => {
    if (user) return null;
    const nameField = (fields as { name?: FieldMetadata<string> } & typeof fields).name;
    const emailField = (fields as { email?: FieldMetadata<string> } & typeof fields).email;
    const phoneNumberField = (fields as { phoneNumber?: FieldMetadata<string> } & typeof fields)
      .phoneNumber;

    if (!nameField || !emailField || !phoneNumberField) return null;

    return { nameField, emailField, phoneNumberField };
  }, [user, fields]);

  // Handler for navigating to auth - shared between mobile and desktop
  const handleNavigateToAuth = useCallback(() => {
    const currentParams = new URLSearchParams(searchParams);

    if (dateRange.from) {
      currentParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
    }

    if (dateRange.to) {
      currentParams.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }

    if (fields.pickupAddress.value) {
      currentParams.set("pickupAddress", fields.pickupAddress.value);
    }

    currentParams.set("sameLocation", sameLocationChecked ? "true" : "false");

    if (!sameLocationChecked && fields.dropOffAddress.value) {
      currentParams.set("dropOffAddress", fields.dropOffAddress.value);
    }

    if (
      bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
      "flightNumber" in fields &&
      fields.flightNumber?.value
    ) {
      currentParams.set("flightNumber", fields.flightNumber.value);
    } else if (
      fields.pickupTime.value &&
      (bookingType === DAY_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE)
    ) {
      currentParams.set("pickupTime", fields.pickupTime.value);
    }

    currentParams.set("bookingType", bookingType);
    currentParams.set("role", "user");
    currentParams.set("requiresFullTank", String(requiresFullTank));

    const redirectTo = `/cars/${car.id}?${currentParams.toString()}`;
    navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [
    searchParams,
    dateRange,
    fields,
    sameLocationChecked,
    bookingType,
    requiresFullTank,
    car.id,
    navigate,
  ]);

  return (
    <Form {...getFormProps(form)} method="POST" autoComplete="off">
      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="totalAmount" value={finalTotalCost} />
      <input type="hidden" name="requiresFullTank" value={String(requiresFullTank)} />
      <input type="hidden" name="useCredits" value={useCreditsAmount} />

      <Card className="rounded shadow-xl inset-shadow-sm transform-gpu">
        <CardHeader className="px-4 lg:px-6 py-4">
          <CardTitle>
            <span className="text-lg" aria-live="polite">
              {formatCurrency(totalDays > 0 ? currentCarPrice * totalDays : currentCarPrice)}

              <span className=" text-sm text-gray-500 font-normal">
                {" "}
                per {BOOKING_TYPE_LABELS[bookingType].perUnit}
              </span>
            </span>
          </CardTitle>
        </CardHeader>

        {hasValidBookingType ? (
          <CardContent className="space-y-4 [&>div:first-of-type]:!mt-0 px-4 lg:px-6">
            <input type="hidden" name="bookingType" value={bookingType} />

            <div className="space-y-1">
              <Label className="font-semibold">Booking Type</Label>
              <BookingTypeTabs
                value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
                onValueChange={handleBookingTypeChange}
                variant="modal"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${form.id}-daterange`} className="font-semibold">
                Select Dates
              </Label>
              {bookingType === AIRPORT_PICKUP_BOOKING_TYPE ? (
                <SingleDatePicker
                  isAirportPickup={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                  date={dateRange.from}
                  onDateChange={handleFromDateChange}
                  showLabel={false}
                />
              ) : (
                <div className="flex gap-2">
                  <SingleDatePicker
                    className="flex-1"
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    date={dateRange.from}
                    onDateChange={handleFromDateChange}
                    showLabel={false}
                    placeholder="From date"
                  />
                  <SingleDatePicker
                    className="flex-1"
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    date={dateRange.to}
                    onDateChange={handleToDateChange}
                    showLabel={false}
                    placeholder="To date"
                    minDate={toDateMinDate}
                    disabled={!dateRange.from}
                  />
                </div>
              )}
            </div>
            {totalDays > 0 && !isAvailable && (
              <div className="text-red-600 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-center">
                Car not available for the selected date.
              </div>
            )}
            {carIsAvailableToBook && (
              <div className="w-full space-y-4">
                <BookingFormFields
                  bookingType={bookingType}
                  dateRange={dateRange}
                  fallbackDate={fallbackDateRef.current}
                  fields={{
                    pickupTime: fields.pickupTime,
                    flightNumber: fields.flightNumber,
                    pickupAddress: fields.pickupAddress,
                    dropOffAddress: fields.dropOffAddress,
                    sameLocation: fields.sameLocation,
                  }}
                  sameLocationChecked={sameLocationChecked}
                  formId={form.id}
                  errorRingClasses={ERROR_RING_CLASSES}
                  nightBookingHelperText={nightBookingHelperText}
                  onPickupTimeChange={handlePickupTimeChange}
                  onSameLocationChange={handleSameLocationChange}
                  onAddressUpdate={(name, value) => {
                    form.update({ name, value });
                    const normalizedValue = value.trim();
                    const newSearchParams = new URLSearchParams(searchParams);

                    if (normalizedValue) {
                      newSearchParams.set(name, normalizedValue);
                    } else {
                      newSearchParams.delete(name);
                    }

                    // Keep booking type + key form fields reflected in URL so auto-validation
                    // behavior stays consistent across search/home and direct car page flows.
                    setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });

                    // Calculate trip duration when drop-off address is selected
                    if (name === "dropOffAddress" && bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
                      handleDropOffAddressSelected(value);
                    }
                  }}
                  validatedFlight={validatedFlight}
                  onFlightValidated={setValidatedFlight}
                />

                {/* Guest Details - Desktop only (mobile version is outside Card) */}
                <GuestDetailsPlacement
                  guestFields={guestFields}
                  errorRingClasses={ERROR_RING_CLASSES}
                  className="hidden lg:block"
                  variant="desktop"
                />

                <BookingAddons
                  bookingType={bookingType}
                  totalDays={totalDays}
                  fuelNote={fuelNote}
                  fuelUpgradeRate={car.fuelUpgradeRate ?? 0}
                  requiresFullTank={requiresFullTank}
                  onFullTankChange={handleFullTankChange}
                  user={user}
                  bookingCredits={bookingCredits}
                  useCreditsAmount={useCreditsAmount}
                  subtotalBeforeDiscounts={subtotalBeforeDiscounts}
                  referralDiscountAmount={referralDiscountAmount}
                  onUseCreditsChange={handleUseCreditsChange}
                  pricingIncludesFuel={car.pricingIncludesFuel}
                />
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            <div className="text-red-600 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-center">
              <p className="font-medium mb-2">Invalid booking type</p>
              <p>
                Please{" "}
                <Link to="/" className="underline font-medium hover:text-red-800">
                  select a car from the home page
                </Link>{" "}
                to continue.
              </p>
            </div>
          </CardContent>
        )}

        {hasValidBookingType && carIsAvailableToBook && (
          <CardFooter className="hidden lg:flex flex-col items-stretch space-y-4 bg-gray-50 p-4 border-t">
            {/* Show trip duration for airport pickup bookings */}
            {bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
              tripDetailsArrivalTime &&
              tripDuration && (
                <TripDetails
                  estimatedArrival={tripDetailsArrivalTime}
                  durationInMinutes={tripDuration.durationInMinutes}
                  distanceText={tripDuration.distanceText}
                  status={tripDuration.status}
                />
              )}

            <BookingCostBreakdown
              currentCarPrice={currentCarPrice}
              totalDays={totalDays}
              bookingType={bookingType}
              baseTotal={baseTotal}
              fuelUpgradeCost={fuelUpgradeCost}
              platformFee={platformFee}
              platformServiceFeeRate={platformServiceFeeRate}
              referralDiscountAmount={referralDiscountAmount}
              useCreditsAmount={useCreditsAmount}
              vatRate={vatRate}
              vat={vat}
              finalTotalCost={finalTotalCost}
              pricingIncludesFuel={car.pricingIncludesFuel}
            />

            {/* Display booking submission errors */}
            {showFetcherError && bookingFetcher.data?.error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-3 text-sm">
                {bookingFetcher.data.error}
              </div>
            )}

            <BookingActionsPlacement
              user={user}
              isPending={isPending}
              onNavigateToAuth={handleNavigateToAuth}
            />
          </CardFooter>
        )}
      </Card>

      {/* Mobile only: Cost breakdown in its own bordered section - OUTSIDE Card */}
      {hasValidBookingType && carIsAvailableToBook && (
        <div
          className={cn(
            "lg:hidden mt-4 pb-40",
            !user && bookingType === AIRPORT_PICKUP_BOOKING_TYPE && "pb-52",
            !user && bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && "pb-48",
          )}
        >
          <div className="space-y-4">
            {/* Guest Details - Mobile only */}
            <GuestDetailsPlacement
              guestFields={guestFields}
              errorRingClasses={ERROR_RING_CLASSES}
              className="w-full lg:hidden"
              showHeading
              variant="mobile"
            />

            {/* Trip details for airport pickup */}
            {bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
              tripDetailsArrivalTime &&
              tripDuration && (
                <TripDetails
                  estimatedArrival={tripDetailsArrivalTime}
                  durationInMinutes={tripDuration.durationInMinutes}
                  distanceText={tripDuration.distanceText}
                  status={tripDuration.status}
                />
              )}

            <BookingCostBreakdown
              currentCarPrice={currentCarPrice}
              totalDays={totalDays}
              bookingType={bookingType}
              baseTotal={baseTotal}
              fuelUpgradeCost={fuelUpgradeCost}
              platformFee={platformFee}
              platformServiceFeeRate={platformServiceFeeRate}
              referralDiscountAmount={referralDiscountAmount}
              useCreditsAmount={useCreditsAmount}
              vatRate={vatRate}
              vat={vat}
              finalTotalCost={finalTotalCost}
              pricingIncludesFuel={car.pricingIncludesFuel}
            />

            {/* Display booking submission errors */}
            {showFetcherError && bookingFetcher.data?.error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-3 text-sm">
                {bookingFetcher.data.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Sticky footer with just total and pay button - OUTSIDE Card */}
      {hasValidBookingType && carIsAvailableToBook && (
        <div className="lg:hidden fixed bottom-0 rounded-t-xl left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
          {/* Display booking submission errors */}
          {showFetcherError && bookingFetcher.data?.error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200">
              <p className="text-red-800 text-sm">{bookingFetcher.data.error}</p>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Total row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <span className="text-base font-semibold">{formatCurrency(finalTotalCost)}</span>
            </div>

            <BookingActionsPlacement
              user={user}
              isPending={isPending}
              onNavigateToAuth={handleNavigateToAuth}
            />
          </div>
        </div>
      )}
    </Form>
  );
}
