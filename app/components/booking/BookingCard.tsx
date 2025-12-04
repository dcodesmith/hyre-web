import { type FieldMetadata, getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { Car, User } from "@prisma/client";
import { Link, useNavigate, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isAfter,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Form } from "~/components/CSRFForm";
import { calculateBookingUnits } from "~/lib/booking-utils";
import { formatCurrency } from "~/lib/utils";
import {
  BOOKING_TYPE_LABELS,
  BOOKING_TYPE_OPTIONS,
  BOOKING_TYPE_OPTIONS_MAP,
  BookingType,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  TAB_VALUE_TO_BOOKING_TYPE,
} from "../bookingTypes";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { BookingActions } from "./BookingActions";
import { BookingAddons } from "./BookingAddons";
import { BookingCostBreakdown } from "./BookingCostBreakdown";
import { BookingFormFields } from "./BookingFormFields";
import { DateRangePicker } from "./DateRangePicker";
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
  securityDetailRate,
}: BookingCardProps) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();
  const [searchParams, setSearchParams] = useSearchParams();

  // Type guard for BookingType validation
  const isValidBookingType = (value: string | null): value is BookingType =>
    !!value && BOOKING_TYPE_OPTIONS.includes(value as BookingType);

  const bookingTypeParam = searchParams.get("bookingType");
  const hasValidBookingType = isValidBookingType(bookingTypeParam);

  const bookingType: BookingType = hasValidBookingType ? bookingTypeParam : DAY_BOOKING_TYPE;

  const navigation = useNavigation();
  const isPending = navigation.state === "submitting" && navigation.formMethod === "POST";

  const [sameLocationChecked, setSameLocationChecked] = useState<boolean>(
    searchParams.get("sameLocation") !== "false",
  );
  const [includeSecurityDetail, setIncludeSecurityDetail] = useState(false);
  const [requiresFullTank, setRequiresFullTank] = useState(false);
  const [referralDiscount, setReferralDiscount] = useState<{
    eligible: boolean;
    discountAmount: number;
  } | null>(null);
  const [bookingCredits, setBookingCredits] = useState<BookingCredits | null>(null);
  const [useCreditsAmount, setUseCreditsAmount] = useState(0);
  const fallbackDateRef = useRef<Date>(startOfDay(new Date()));

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
  const [_, setIsDatePickerOpen] = useState(false);

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

    return car.dayRate;
  }, [bookingType, car.nightRate, car.fullDayRate, car.dayRate]);

  const baseTotal = useMemo(() => currentCarPrice * totalDays, [currentCarPrice, totalDays]);
  const securityDetailTotalCost = useMemo(
    () => (includeSecurityDetail ? securityDetailRate * totalDays : 0),
    [includeSecurityDetail, securityDetailRate, totalDays],
  );

  const fuelUpgradeCost = useMemo(() => {
    // FULL_DAY and NIGHT bookings don't have fuel upgrades
    if (
      bookingType === FULL_DAY_BOOKING_TYPE ||
      bookingType === NIGHT_BOOKING_TYPE ||
      !requiresFullTank ||
      totalDays >= 3
    ) {
      return 0;
    }
    return Number(car.fuelUpgradeRate);
  }, [bookingType, requiresFullTank, car.fuelUpgradeRate, totalDays]);

  const subtotal = useMemo(
    () => baseTotal + securityDetailTotalCost + fuelUpgradeCost,
    [baseTotal, securityDetailTotalCost, fuelUpgradeCost],
  );
  // Per policy, platform fee excludes security detail
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

  const [form, fields] = useForm({
    id: `booking-form-${car.id}`,
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      carId: car.id,
      pickupTime:
        bookingType === NIGHT_BOOKING_TYPE
          ? "11:00 PM"
          : searchParams.get("pickupTime") || undefined,
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
            ["pickupTime", "pickupAddress", "dropOffAddress"].includes(key)
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
      submit(formData, { method: "POST", action: `/bookings?${searchParams.toString()}` });
    },
  });

  const handleDateChange = useCallback(
    (range: DateRange) => {
      const normalizedRange = {
        from: range.from ? startOfDay(range.from) : undefined,
        to: range.to ? startOfDay(range.to) : undefined,
      };

      if (
        normalizedRange.from &&
        normalizedRange.to &&
        isAfter(normalizedRange.from, normalizedRange.to)
      ) {
        setDateRange({ from: normalizedRange.from, to: undefined });
        const resetParams = new URLSearchParams(searchParams);
        resetParams.set("from", format(normalizedRange.from, "yyyy-MM-dd"));
        resetParams.delete("to");
        setSearchParams(resetParams, { replace: true, preventScrollReset: true });
      } else {
        setDateRange(normalizedRange);
        const newSearchParams = new URLSearchParams(searchParams);

        if (normalizedRange.from) {
          newSearchParams.set("from", format(normalizedRange.from, "yyyy-MM-dd"));
        } else {
          newSearchParams.delete("from");
        }

        if (normalizedRange.to) {
          newSearchParams.set("to", format(normalizedRange.to, "yyyy-MM-dd"));
        } else {
          newSearchParams.delete("to");
        }

        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams],
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

        // Reset dates and pickup time when changing booking type
        setDateRange({ from: undefined, to: undefined });
        newSearchParams.delete("from");
        newSearchParams.delete("to");
        newSearchParams.delete("pickupTime");

        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleSecurityDetailChange = useCallback((checked: boolean) => {
    setIncludeSecurityDetail(!!checked);
  }, []);

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

  return (
    <Form {...getFormProps(form)} method="POST" autoComplete="off">
      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="totalAmount" value={finalTotalCost} />
      <input type="hidden" name="includeSecurityDetail" value={String(includeSecurityDetail)} />
      <input type="hidden" name="requiresFullTank" value={String(requiresFullTank)} />
      <input type="hidden" name="useCredits" value={useCreditsAmount} />

      <Card className="rounded sticky top-4 shadow-xl inset-shadow-sm transform-gpu">
        <CardHeader className="px-6 py-4">
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

        {!hasValidBookingType ? (
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
        ) : (
          <CardContent className="space-y-4">
            <input type="hidden" name="bookingType" value={bookingType} />

            <div className="space-y-1">
              <Label className="font-semibold">Booking Type</Label>
              <Tabs
                value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
                onValueChange={handleBookingTypeChange}
                className="w-full"
              >
                <TabsList className="p-2 gap-2 tabs-list-slider w-full h-auto before:w-[calc((100%-0.5rem)/3)]">
                  {BOOKING_TYPE_OPTIONS.map((type) => {
                    const option = BOOKING_TYPE_OPTIONS_MAP[type];
                    return (
                      <TabsTrigger
                        key={option.value}
                        value={option.value}
                        className="flex flex-col data-[state=active]:shadow-none tabs-trigger-slider data-[state=active]:bg-transparent"
                      >
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="text-xs text-gray-600">{option.duration}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${form.id}-daterange`} className="font-semibold">
                Select Dates
              </Label>
              <DateRangePicker
                isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                date={dateRange}
                onDateChange={handleDateChange}
                onOpenChange={setIsDatePickerOpen}
              />
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
                  onAddressUpdate={(name, value) => form.update({ name, value })}
                />

                <BookingAddons
                  bookingType={bookingType}
                  totalDays={totalDays}
                  fuelNote={fuelNote}
                  fuelUpgradeRate={car.fuelUpgradeRate}
                  securityDetailRate={securityDetailRate}
                  requiresFullTank={requiresFullTank}
                  includeSecurityDetail={includeSecurityDetail}
                  onFullTankChange={handleFullTankChange}
                  onSecurityDetailChange={handleSecurityDetailChange}
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
        )}

        {hasValidBookingType && carIsAvailableToBook && (
          <CardFooter className="flex flex-col items-stretch space-y-4 bg-gray-50 p-4 border-t">
            <BookingCostBreakdown
              currentCarPrice={currentCarPrice}
              totalDays={totalDays}
              bookingType={bookingType}
              baseTotal={baseTotal}
              includeSecurityDetail={includeSecurityDetail}
              securityDetailTotalCost={securityDetailTotalCost}
              fuelUpgradeCost={fuelUpgradeCost}
              platformFee={platformFee}
              platformServiceFeeRate={platformServiceFeeRate}
              referralDiscountAmount={referralDiscountAmount}
              useCreditsAmount={useCreditsAmount}
              vatRate={vatRate}
              vat={vat}
              finalTotalCost={finalTotalCost}
            />

            {/* Only show booking section if user is not a fleet owner */}
            {(user === null ||
              !user.roles?.some((role) =>
                ["fleetOwner", "admin", "staff"].includes(role.name),
              )) && (
              <BookingActions
                user={user}
                isPending={isPending}
                fields={{
                  name: "name" in fields ? (fields.name as FieldMetadata<string>) : undefined,
                  email: "email" in fields ? (fields.email as FieldMetadata<string>) : undefined,
                  phoneNumber:
                    "phoneNumber" in fields
                      ? (fields.phoneNumber as FieldMetadata<string>)
                      : undefined,
                }}
                onNavigateToAuth={() => {
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
                }}
              />
            )}
          </CardFooter>
        )}
      </Card>
    </Form>
  );
}
