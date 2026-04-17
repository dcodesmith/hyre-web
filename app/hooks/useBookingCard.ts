import { type FieldMetadata, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isAfter,
  startOfDay,
  subDays,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { useFetcher, useNavigate, useNavigation, useSearchParams } from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import type { BookingCardProps } from "~/components/booking/booking-card.types";
import { getOrdinal } from "~/components/booking/helpers";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  BookingType,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  TAB_VALUE_TO_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { useBookingFlight } from "~/hooks/useBookingFlight";
import { useBookingPricing, useFinalPricing } from "~/hooks/useBookingPricing";
import { listRateForBookingType, useBookingPromoCompare } from "~/hooks/useBookingPromoCompare";
import { useReferralCredits } from "~/hooks/useReferralCredits";
import {
  calculateBookingUnits,
  getToDateMinDate,
  isValidToDateSelection,
} from "~/lib/booking-utils";
import { getBookingSchema } from "~/schemas/booking.schema";
import { normalizePickupTimeParam } from "~/utils/pickup-time";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

/** Lagos calendar day for URL `from` / `to` (matches hero search + flight API). */
function lagosDateParam(date: Date): string {
  return formatInTimeZone(date, LAGOS_TIMEZONE, "yyyy-MM-dd");
}

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

const isValidBookingType = (value: string | null): value is BookingType =>
  !!value && BOOKING_TYPE_OPTIONS.includes(value as BookingType);

const getDefaultPickupTime = (
  bookingType: BookingType,
  searchParams: URLSearchParams,
): string | undefined => {
  if (bookingType === NIGHT_BOOKING_TYPE) return "11:00 PM";
  return searchParams.get("pickupTime") || undefined;
};

export function useBookingCard({
  car,
  isAvailable = false,
  user,
  vatRate,
  platformServiceFeeRate,
  partnerSlug = null,
  promotion = null,
  originalRates = null,
  promotionPricingPreview = null,
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
  const clearFetcherErrorOnFlightCommit = useCallback(() => {
    setShowFetcherError(false);
  }, []);

  const {
    validatedFlight,
    setValidatedFlight,
    tripDuration,
    processedFlightRef,
    handleDropOffAddressSelected,
    clearFlightState,
  } = useBookingFlight({
    bookingType,
    searchParams,
    onValidatedFlightCommit: clearFetcherErrorOnFlightCommit,
  });
  const tripDetailsArrivalTime =
    validatedFlight?.estimatedArrival ??
    validatedFlight?.actualArrival ??
    validatedFlight?.scheduledArrival;

  // Date range parsing
  const initialDateRange = useMemo(() => {
    const parseDateParam = (param: string | null) => {
      if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return undefined;
      try {
        const date = fromZonedTime(`${param}T00:00:00`, LAGOS_TIMEZONE);
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
    baseTotalOverride: promotionPricingPreview?.baseTotal,
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

  const promoCompare = useBookingPromoCompare({
    promotion,
    originalRates,
    compareAtBaseTotalOverride: promotionPricingPreview?.compareAtBaseTotal,
    totalDays,
    bookingType,
    baseTotal,
    finalTotalCost,
    fuelUpgradeCost,
    platformServiceFeeRate,
    user,
    referralDiscount,
    useCreditsAmount,
    vatRate,
  });

  const hasAnyPromoDiscount =
    promotionPricingPreview?.discountCoverage != null
      ? promotionPricingPreview.discountCoverage !== "NONE"
      : !!promotion;
  const listRate = originalRates ? listRateForBookingType(bookingType, originalRates) : null;
  const promoHeaderUnitPrice =
    promotionPricingPreview?.segments.find((segment) => segment.kind === "PROMO")?.unitPrice ??
    null;
  const effectiveHeaderUnitPrice = promoHeaderUnitPrice ?? currentCarPrice;
  const shouldShowHeaderPromoStrike =
    hasAnyPromoDiscount &&
    !!promotion &&
    typeof listRate === "number" &&
    listRate > effectiveHeaderUnitPrice;
  const shouldHighlightHeaderRate = hasAnyPromoDiscount;

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
          currentParams.set("from", lagosDateParam(dateRange.from));
        } else {
          currentParams.delete("from");
        }

        if (dateRange.to) {
          currentParams.set("to", lagosDateParam(dateRange.to));
        } else {
          currentParams.delete("to");
        }

        currentParams.set("sameLocation", sameLocationChecked ? "true" : "false");
        currentParams.set("bookingType", bookingType);

        currentParams.set("requiresFullTank", String(requiresFullTank));
        const carBasePath = partnerSlug ? `/partners/${partnerSlug}/cars` : "/cars";
        const redirectTo = `${carBasePath}/${car.id}?${currentParams.toString()}`;

        return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      formData.append("csrf", csrfToken);
      const bookingQuery = searchParams.toString();
      bookingFetcher.submit(formData, {
        method: "POST",
        action: bookingQuery ? `/bookings?${bookingQuery}` : "/bookings",
      });
    },
  });

  const handleFromDateChange = useCallback(
    (date: Date | undefined) => {
      setShowFetcherError(false);
      const normalizedFrom = date ? startOfDay(date) : undefined;

      // For airport pickup, automatically set "to" to same as "from"
      if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
        setDateRange({ from: normalizedFrom, to: normalizedFrom });
        const newSearchParams = new URLSearchParams(searchParams);

        if (normalizedFrom) {
          newSearchParams.set("from", lagosDateParam(normalizedFrom));
          // Set to same as from for airport pickup (required for calculateBookingUnits)
          newSearchParams.set("to", lagosDateParam(normalizedFrom));
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
        newSearchParams.set("from", lagosDateParam(normalizedFrom));
      } else {
        newSearchParams.delete("from");
      }

      if (newTo) {
        newSearchParams.set("to", lagosDateParam(newTo));
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
      setShowFetcherError(false);
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
        newSearchParams.set("from", lagosDateParam(dateRange.from));
      } else {
        newSearchParams.delete("from");
      }

      if (normalizedTo) {
        newSearchParams.set("to", lagosDateParam(normalizedTo));
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

  // Airport pickup: sync URL from arrival + drive time once trip duration is known.
  const searchParamsSnapshot = searchParams.toString();
  const tripDurationMinutes = tripDuration?.durationInMinutes ?? null;
  const dateRangeFromMs = dateRange.from?.getTime() ?? null;
  const dateRangeToMs = dateRange.to?.getTime() ?? null;

  useEffect(() => {
    if (
      bookingType !== AIRPORT_PICKUP_BOOKING_TYPE ||
      !tripDetailsArrivalTime ||
      tripDurationMinutes == null
    ) {
      return;
    }

    const sp = new URLSearchParams(searchParamsSnapshot);
    const arrivalDate = new Date(tripDetailsArrivalTime);
    const pickupDateTime = new Date(arrivalDate.getTime() + 40 * 60 * 1000); // 40 min after arrival

    const bufferedDriveMinutes = Math.ceil(tripDurationMinutes * 1.2);
    const dropOffDateTime = new Date(pickupDateTime.getTime() + bufferedDriveMinutes * 60 * 1000);

    const pickupDateOnly = formatInTimeZone(pickupDateTime, LAGOS_TIMEZONE, "yyyy-MM-dd");
    const dropOffDateOnly = formatInTimeZone(dropOffDateTime, LAGOS_TIMEZONE, "yyyy-MM-dd");
    const nextDateRange = {
      from: fromZonedTime(`${pickupDateOnly}T00:00:00`, LAGOS_TIMEZONE),
      to: fromZonedTime(`${dropOffDateOnly}T00:00:00`, LAGOS_TIMEZONE),
    };

    const pickupTimeFormatted = normalizePickupTimeParam(
      formatInTimeZone(pickupDateTime, LAGOS_TIMEZONE, "h:mm a"),
    );

    const newParams = new URLSearchParams(sp);
    newParams.set("from", pickupDateOnly);
    newParams.set("to", dropOffDateOnly);
    newParams.set("pickupTime", pickupTimeFormatted);

    const needsDateRangeSync =
      dateRangeFromMs !== nextDateRange.from.getTime() ||
      dateRangeToMs !== nextDateRange.to.getTime();

    if (newParams.toString() === sp.toString()) {
      if (needsDateRangeSync) {
        setDateRange(nextDateRange);
      }
      return;
    }

    const urlPickupNorm = normalizePickupTimeParam(sp.get("pickupTime"));
    const logicallyMatchesUrl =
      sp.get("from") === pickupDateOnly &&
      sp.get("to") === dropOffDateOnly &&
      urlPickupNorm === pickupTimeFormatted;

    if (logicallyMatchesUrl) {
      if (needsDateRangeSync) {
        setDateRange(nextDateRange);
      }
      return;
    }

    setDateRange(nextDateRange);
    setSearchParams(newParams, { replace: true, preventScrollReset: true });
  }, [
    bookingType,
    tripDetailsArrivalTime,
    tripDurationMinutes,
    searchParamsSnapshot,
    setSearchParams,
    dateRangeFromMs,
    dateRangeToMs,
  ]);

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
      currentParams.set("from", lagosDateParam(dateRange.from));
    }

    if (dateRange.to) {
      currentParams.set("to", lagosDateParam(dateRange.to));
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

    const carBasePath = partnerSlug ? `/partners/${partnerSlug}/cars` : "/cars";
    const redirectTo = `${carBasePath}/${car.id}?${currentParams.toString()}`;
    navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [
    searchParams,
    dateRange,
    fields,
    sameLocationChecked,
    bookingType,
    requiresFullTank,
    car.id,
    partnerSlug,
    navigate,
  ]);

  const handleAddressUpdate = useCallback(
    (name: string, value: string) => {
      form.update({ name, value });
      const normalizedValue = value.trim();
      const newSearchParams = new URLSearchParams(searchParams);

      if (normalizedValue) {
        newSearchParams.set(name, normalizedValue);
      } else {
        newSearchParams.delete(name);
      }

      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });

      if (name === "dropOffAddress" && bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
        handleDropOffAddressSelected(value);
      }
    },
    [bookingType, form, handleDropOffAddressSelected, searchParams, setSearchParams],
  );

  return {
    ERROR_RING_CLASSES,
    baseTotal,
    bookingCredits,
    bookingFetcher,
    bookingType,
    car,
    carIsAvailableToBook,
    currentCarPrice,
    dateRange,
    effectiveHeaderUnitPrice,
    fallbackDateRef,
    fields,
    finalTotalCost,
    form,
    fuelNote,
    fuelUpgradeCost,
    guestFields,
    handleBookingTypeChange,
    handleFromDateChange,
    handleFullTankChange,
    handleNavigateToAuth,
    handleAddressUpdate,
    handlePickupTimeChange,
    handleSameLocationChange,
    handleToDateChange,
    hasAnyPromoDiscount,
    hasValidBookingType,
    isAvailable,
    isPending,
    listRate,
    listRateForBookingType,
    nightBookingHelperText,
    originalRates,
    partnerSlug,
    platformFee,
    platformServiceFeeRate,
    promoCompare,
    promotion,
    promotionPricingPreview,
    referralDiscountAmount,
    requiresFullTank,
    sameLocationChecked,
    setValidatedFlight,
    shouldHighlightHeaderRate,
    shouldShowHeaderPromoStrike,
    showFetcherError,
    subtotalBeforeDiscounts,
    toDateMinDate,
    totalDays,
    tripDetailsArrivalTime,
    tripDuration,
    useCreditsAmount,
    user,
    handleUseCreditsChange,
    validatedFlight,
    vat,
    vatRate,
  };
}

export type BookingCardViewModel = ReturnType<typeof useBookingCard>;
