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
import type { ValidatedFlight } from "~/services/flight-validation.server";
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
import { getFuelTankNote, getOrdinal } from "./helpers";
import { getBookingSchema } from "~/schemas/booking.schema";

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

type BookingCardProps = {
  readonly car: Car & { fuelUpgradeRate: number };
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

  // Type guard for BookingType validation
  const isValidBookingType = (value: string | null): value is BookingType =>
    !!value && BOOKING_TYPE_OPTIONS.includes(value as BookingType);

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
  const [validatedFlight, setValidatedFlight] = useState<ValidatedFlight | null>(null);
  const [tripDuration, setTripDuration] = useState<{
    durationInMinutes: number;
    durationText: string;
    distanceText: string;
    status: "success" | "fallback";
  } | null>(null);
  const [referralDiscount, setReferralDiscount] = useState<{
    eligible: boolean;
    discountAmount: number;
  } | null>(null);
  const [bookingCredits, setBookingCredits] = useState<BookingCredits | null>(null);
  const [useCreditsAmount, setUseCreditsAmount] = useState(0);
  const fallbackDateRef = useRef<Date>(startOfDay(new Date()));
  const processedFlightRef = useRef<string | null>(null);

  const initialDateRange = useMemo(() => {
    const parseDateParam = (param: string | null) => {
      if (!param) {
        return undefined;
      }

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

  const currentCarPrice = useMemo(() => {
    if (bookingType === NIGHT_BOOKING_TYPE) {
      return car.nightRate;
    }

    if (bookingType === FULL_DAY_BOOKING_TYPE) {
      return car.fullDayRate;
    }

    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
      return car.airportPickupRate; // Use dayRate for airport pickup (can be updated to use airportPickupRate if added to schema)
    }

    return car.dayRate;
  }, [bookingType, car.nightRate, car.fullDayRate, car.dayRate, car.airportPickupRate]);

  const baseTotal = useMemo(() => currentCarPrice * totalDays, [currentCarPrice, totalDays]);

  const fuelUpgradeCost = useMemo(() => {
    // FULL_DAY, NIGHT, and AIRPORT_PICKUP bookings don't have fuel upgrades
    if (
      bookingType === FULL_DAY_BOOKING_TYPE ||
      bookingType === NIGHT_BOOKING_TYPE ||
      bookingType === AIRPORT_PICKUP_BOOKING_TYPE ||
      !requiresFullTank ||
      totalDays >= 3
    ) {
      return 0;
    }
    return Number(car.fuelUpgradeRate);
  }, [bookingType, requiresFullTank, car.fuelUpgradeRate, totalDays]);

  const subtotal = useMemo(() => baseTotal + fuelUpgradeCost, [baseTotal, fuelUpgradeCost]);
  const platformFeeBase = useMemo(() => baseTotal + fuelUpgradeCost, [baseTotal, fuelUpgradeCost]);
  const platformFee = useMemo(
    () => platformFeeBase * (platformServiceFeeRate / 100),
    [platformFeeBase, platformServiceFeeRate],
  );

  const fuelNote = useMemo(
    () => getFuelTankNote(totalDays, requiresFullTank, bookingType),
    [totalDays, requiresFullTank, bookingType],
  );

  const subtotalBeforeDiscounts = useMemo(() => subtotal + platformFee, [subtotal, platformFee]);

  const referralDiscountAmount = useMemo(() => {
    if (!user || !referralDiscount?.eligible) return 0;
    return Math.min(referralDiscount.discountAmount || 0, subtotalBeforeDiscounts);
  }, [user, referralDiscount, subtotalBeforeDiscounts]);

  const subtotalAfterDiscounts = useMemo(
    () => Math.max(0, subtotalBeforeDiscounts - referralDiscountAmount - useCreditsAmount),
    [subtotalBeforeDiscounts, referralDiscountAmount, useCreditsAmount],
  );

  const vat = useMemo(
    () => subtotalAfterDiscounts * (vatRate / 100),
    [subtotalAfterDiscounts, vatRate],
  );

  const finalTotalCost = useMemo(() => subtotalAfterDiscounts + vat, [subtotalAfterDiscounts, vat]);

  const carIsAvailableToBook = useMemo(
    () => !!dateRange.from && !!dateRange.to && totalDays > 0 && isAvailable,
    [dateRange.from, dateRange.to, totalDays, isAvailable],
  );

  // Check referral eligibility when booking details change
  useEffect(() => {
    if (!user || !carIsAvailableToBook || subtotalBeforeDiscounts <= 0) {
      setReferralDiscount(null);
      return;
    }

    const controller = new AbortController();

    const checkEligibility = async () => {
      try {
        const response = await fetch(
          `/api/referrals/eligibility?amount=${subtotalBeforeDiscounts}&type=${bookingType}`,
          { signal: controller.signal },
        );

        if (response.ok) {
          const data = await response.json();
          setReferralDiscount(data);
        } else {
          setReferralDiscount(null);
        }
      } catch (error) {
        // Ignore abort errors (expected when component unmounts or deps change)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to check referral eligibility:", error);
        setReferralDiscount(null);
      }
    };

    checkEligibility();

    return () => controller.abort();
  }, [user, carIsAvailableToBook, subtotalBeforeDiscounts, bookingType]);

  // Fetch user's available booking credits
  useEffect(() => {
    if (!user) {
      setBookingCredits(null);
      return;
    }

    const controller = new AbortController();

    const fetchCredits = async () => {
      try {
        const response = await fetch("/api/referrals/user", { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setBookingCredits({
            availableCredits: data.stats?.availableCredits || 0,
            totalEarned: data.stats?.totalEarned || 0,
            maxCreditsPerBooking: data.stats?.maxCreditsPerBooking,
          });
        } else {
          setBookingCredits(null);
        }
      } catch (error) {
        // Ignore abort errors (expected when component unmounts or deps change)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch booking credits:", error);
        setBookingCredits(null);
      }
    };

    fetchCredits();

    return () => controller.abort();
  }, [user]);

  // Compute default pickup time based on booking type
  const getDefaultPickupTime = (): string | undefined => {
    if (bookingType === NIGHT_BOOKING_TYPE) return "11:00 PM";
    return searchParams.get("pickupTime") || undefined;
  };
  const defaultPickupTime = getDefaultPickupTime();

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
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("bookingType", newBookingType);

        // Reset dates, pickup time, and flight number when changing booking type
        setDateRange({ from: undefined, to: undefined });
        newSearchParams.delete("from");
        newSearchParams.delete("to");
        newSearchParams.delete("pickupTime");
        newSearchParams.delete("flightNumber");

        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleFullTankChange = useCallback((checked: boolean) => {
    setRequiresFullTank(!!checked);
  }, []);

  const handleUseCreditsChange = useCallback(
    (checked: boolean, bookingCredits: BookingCredits) => {
      if (checked) {
        setUseCreditsAmount(
          Math.min(
            bookingCredits.availableCredits,
            subtotalBeforeDiscounts - referralDiscountAmount,
            bookingCredits.maxCreditsPerBooking,
          ),
        );
      } else {
        setUseCreditsAmount(0);
      }
    },
    [subtotalBeforeDiscounts, referralDiscountAmount],
  );

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

  // Auto-validate flight from URL on component mount
  useEffect(() => {
    const flightNumber = searchParams.get("flightNumber");
    const from = searchParams.get("from");

    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && flightNumber && from && !validatedFlight) {
      const controller = new AbortController();

      // Validate the flight from the URL
      const validateFlightFromUrl = async () => {
        try {
          const response = await fetch(
            `/api/search-flight?flightNumber=${encodeURIComponent(flightNumber)}&date=${from}`,
            { signal: controller.signal },
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.flight && !controller.signal.aborted) {
              setValidatedFlight(data.flight);
            }
          }
        } catch (error) {
          // Ignore abort errors (expected when component unmounts or deps change)
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          console.error("Failed to validate flight from URL:", error);
        }
      };

      validateFlightFromUrl();

      return () => controller.abort();
    }
  }, [searchParams, bookingType, validatedFlight]);

  // Handle validated flight - auto-fill pickup address with destination airport
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

  // Calculate trip duration for AIRPORT_PICKUP bookings when drop-off address is selected
  const handleDropOffAddressSelected = useCallback(
    async (address: string) => {
      if (bookingType !== AIRPORT_PICKUP_BOOKING_TYPE || !validatedFlight) {
        return;
      }

      if (!address || address.trim().length === 0) {
        setTripDuration(null);
        return;
      }

      try {
        const params = new URLSearchParams({
          destination: address,
        });

        // If we have flight arrival time, use it for traffic estimation
        if (validatedFlight.estimatedArrival) {
          params.set("arrivalTime", validatedFlight.estimatedArrival);
        }

        const response = await fetch(`/api/calculate-trip-duration?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTripDuration({
              durationInMinutes: data.durationInMinutes,
              durationText: data.durationText,
              distanceText: data.distanceText,
              status: data.status,
            });
          } else {
            setTripDuration(null);
          }
        } else {
          setTripDuration(null);
        }
      } catch (error) {
        console.error("Failed to calculate trip duration:", error);
        setTripDuration(null);
      }
    },
    [bookingType, validatedFlight],
  );

  // Update URL params with calculated pickup date and time for AIRPORT_PICKUP bookings
  useEffect(() => {
    if (
      bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
      validatedFlight?.estimatedArrival &&
      tripDuration
    ) {
      const arrivalDate = new Date(validatedFlight.estimatedArrival);
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
  }, [bookingType, validatedFlight, tripDuration, searchParams, setSearchParams]);

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
                    // Calculate trip duration when drop-off address is selected
                    if (name === "dropOffAddress" && bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
                      handleDropOffAddressSelected(value);
                    }
                  }}
                  validatedFlight={validatedFlight}
                  onFlightValidated={setValidatedFlight}
                />

                {/* Guest Details - Desktop only (mobile version is outside Card) */}
                {guestFields && (
                  <div className="hidden lg:block">
                    <GuestDetails
                      fields={{
                        name: guestFields.nameField,
                        email: guestFields.emailField,
                        phoneNumber: guestFields.phoneNumberField,
                      }}
                      errorRingClasses={ERROR_RING_CLASSES}
                    />
                  </div>
                )}

                <BookingAddons
                  bookingType={bookingType}
                  totalDays={totalDays}
                  fuelNote={fuelNote}
                  fuelUpgradeRate={car.fuelUpgradeRate}
                  requiresFullTank={requiresFullTank}
                  onFullTankChange={handleFullTankChange}
                  user={user}
                  bookingCredits={bookingCredits}
                  useCreditsAmount={useCreditsAmount}
                  subtotalBeforeDiscounts={subtotalBeforeDiscounts}
                  referralDiscountAmount={referralDiscountAmount}
                  onUseCreditsChange={handleUseCreditsChange}
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
              validatedFlight?.estimatedArrival &&
              tripDuration &&
              fields.dropOffAddress.value && (
                <TripDetails
                  estimatedArrival={validatedFlight.estimatedArrival}
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
            />

            {/* Display booking submission errors */}
            {showFetcherError && bookingFetcher.data?.error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-3 text-sm">
                {bookingFetcher.data.error}
              </div>
            )}

            {/* Only show booking section if user is not a fleet owner */}
            {!user?.roles?.some((role) => ["fleetOwner", "admin", "staff"].includes(role.name)) && (
              <BookingActions
                user={user}
                isPending={isPending}
                onNavigateToAuth={handleNavigateToAuth}
              />
            )}
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
            {guestFields && (
              <div className="w-full lg:hidden">
                <h3 className="text-sm font-semibold mb-2">Guest Details</h3>
                <GuestDetails
                  fields={{
                    name: guestFields.nameField,
                    email: guestFields.emailField,
                    phoneNumber: guestFields.phoneNumberField,
                  }}
                  errorRingClasses={ERROR_RING_CLASSES}
                />
              </div>
            )}

            {/* Trip details for airport pickup */}
            {bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
              validatedFlight?.estimatedArrival &&
              tripDuration &&
              fields.dropOffAddress.value && (
                <TripDetails
                  estimatedArrival={validatedFlight.estimatedArrival}
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

            {/* Only show booking section if user is not a fleet owner */}
            {!user?.roles?.some((role) => ["fleetOwner", "admin", "staff"].includes(role.name)) && (
              <BookingActions
                user={user}
                isPending={isPending}
                onNavigateToAuth={handleNavigateToAuth}
              />
            )}
          </div>
        </div>
      )}
    </Form>
  );
}
