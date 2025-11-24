import { type FieldMetadata, getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import type { Car, User } from "@prisma/client";
import { Link, useNavigate, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import {
  eachDayOfInterval,
  format,
  isAfter,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { formatCurrency } from "~/lib/utils";
import { calculateBookingUnits } from "~/lib/booking-utils";
import { AutocompleteAddress } from "../AutocompleteAddress";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { BookingTimeSelect } from "./BookingTimeSelect";
import { DateRangePicker } from "./DateRangePicker";

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

const DAY_BOOKING_TYPE = "DAY" as const;
const NIGHT_BOOKING_TYPE = "NIGHT" as const;
const FULL_DAY_BOOKING_TYPE = "FULL_DAY" as const;

const BOOKING_TYPE_OPTIONS = [DAY_BOOKING_TYPE, NIGHT_BOOKING_TYPE, FULL_DAY_BOOKING_TYPE] as const;

type BookingType = (typeof BOOKING_TYPE_OPTIONS)[number];

type BookingCardProps = {
  readonly car: Car & { fuelUpgradeRate: number };
  readonly isAvailable: boolean;
  readonly user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  readonly vatRate: number;
  readonly platformServiceFeeRate: number;
  readonly securityDetailRate: number;
};

const BOOKING_TYPE_LABELS = {
  [DAY_BOOKING_TYPE]: { singular: "day", plural: "days", perUnit: "12-hour day" },
  [NIGHT_BOOKING_TYPE]: { singular: "night", plural: "nights", perUnit: "6-hour night" },
  [FULL_DAY_BOOKING_TYPE]: { singular: "full day", plural: "full days", perUnit: "24-hour day" },
} as const;


const coreBookingFields = z.object({
  carId: z.string(),
  pickupTime: z.string().optional(),
  pickupAddress: z
    .string({ required_error: "Pickup address is required" })
    .min(1, "Pickup address is required"),
  bookingType: z.enum(BOOKING_TYPE_OPTIONS),
});

const dropOffSchema = z.object({
  dropOffAddress: z
    .string({ required_error: "Drop-off address is required" })
    .min(1, "Drop-off address is required"),
});

const guestInfoSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email address"),
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters"),
  phoneNumber: z
    .string({ required_error: "Phone number is required" })
    .min(10, "Phone must be at least 10 digits"),
});

const bookingSchemaSameLocation = coreBookingFields.extend({
  sameLocation: z.literal("true"),
});

const bookingSchemaDifferentLocation = coreBookingFields
  .extend({
    sameLocation: z.literal("false"),
  })
  .extend(dropOffSchema.shape);

const guestSchemaSameLocation = bookingSchemaSameLocation.extend(guestInfoSchema.shape);
const guestSchemaDifferentLocation = bookingSchemaDifferentLocation.extend(guestInfoSchema.shape);

const loggedInUserBookingSchema = z.discriminatedUnion("sameLocation", [
  bookingSchemaSameLocation,
  bookingSchemaDifferentLocation,
]);
const guestUserBookingSchema = z.discriminatedUnion("sameLocation", [
  guestSchemaSameLocation,
  guestSchemaDifferentLocation,
]);

// Function to get the correct schema and apply superRefine
const getBookingSchema = (isGuestBooking: boolean) => {
  // Select the base schema based on guest status
  const baseSchema = isGuestBooking ? guestUserBookingSchema : loggedInUserBookingSchema;

  // Apply refinement for conditional pickupTime validation
  return baseSchema.superRefine((data, ctx) => {
    if (
      (data.bookingType === DAY_BOOKING_TYPE || data.bookingType === FULL_DAY_BOOKING_TYPE) &&
      (!data.pickupTime || data.pickupTime.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup time is required for daytime and full day bookings",
        path: ["pickupTime"],
      });
    }
  });
};


function getOrdinal(n: number): string {
  if (n > 3 && n < 21) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function getFuelTankNote(
  totalDays: number,
  requiresFullTank = false,
  bookingType?: BookingType,
): string | null {
  if (totalDays <= 0) {
    return null;
  }

  let note: string | null = null;

  // For 24-hour bookings, always comes with a full tank
  if (bookingType === FULL_DAY_BOOKING_TYPE) {
    note = "24-hour booking comes with a full tank";
  } else if (bookingType === NIGHT_BOOKING_TYPE) {
    note = "Night booking comes with 1/3rd of a tank";
  } else if (requiresFullTank && totalDays <= 2) {
    note = "Booking comes with a full tank";
  } else if (totalDays === 1) {
    note = "Booking comes with 1/3rd of a tank";
  } else if (totalDays === 2) {
    note = "Booking comes with 2/3rd of a tank";
  } else if (totalDays >= 3) {
    note = "Booking comes with a full tank";
  }

  return note ? `${note}, after that, it's your responsibility to fill the tank.` : null;
}

function FieldError({ errors }: { readonly errors?: readonly string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return <p className="text-red-500 text-sm mt-1">{errors.join(", ")}</p>;
}

interface GuestInfoFieldsProps {
  nameField: FieldMetadata<string>;
  emailField: FieldMetadata<string>;
  phoneNumberField: FieldMetadata<string>;
}

function GuestInfoFields({ nameField, emailField, phoneNumberField }: GuestInfoFieldsProps) {
  const nameProps = getInputProps(nameField, { type: "text", ariaAttributes: true });
  const emailProps = getInputProps(emailField, { type: "email", ariaAttributes: true });
  const phoneProps = getInputProps(phoneNumberField, { type: "tel", ariaAttributes: true }); // Standardized name

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={nameField.id}>Name</Label>
        <Input
          {...nameProps}
          placeholder="Enter your full name"
          className={`w-full rounded ${nameField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={nameField.errors} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={emailField.id}>Email</Label>
        <Input
          {...emailProps}
          placeholder="Enter your email"
          className={`w-full rounded ${emailField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={emailField.errors} />
      </div>
      <div className="space-y-1">
        {/* Standardized name */}
        <Label htmlFor={phoneNumberField.id}>Phone Number</Label>
        <Input
          {...phoneProps}
          placeholder="Enter your phone number"
          className={`w-full rounded ${phoneNumberField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={phoneNumberField.errors} />
      </div>
    </>
  );
}

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
        <CardHeader>
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
              {bookingType !== NIGHT_BOOKING_TYPE ? (
                <div className="space-y-1">
                  <Label htmlFor={fields.pickupTime.id} className="font-semibold">
                    Pickup Time
                  </Label>
                  <BookingTimeSelect
                    date={dateRange.from ?? fallbackDateRef.current}
                    bookingType={bookingType}
                    {...getInputProps(fields.pickupTime, { type: "text", ariaAttributes: true })}
                    className={fields.pickupTime.errors ? ERROR_RING_CLASSES : ""}
                    onValueChange={handlePickupTimeChange}
                  />
                  <FieldError errors={fields.pickupTime.errors} />
                </div>
              ) : (
                <input type="hidden" name="pickupTime" value="11:00 PM" />
              )}

              {bookingType === NIGHT_BOOKING_TYPE && nightBookingHelperText && (
                <div
                  className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-2 text-sm"
                  role="alert"
                >
                  {nightBookingHelperText}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor={fields.pickupAddress.id} className="font-semibold">
                  Pickup Address
                </Label>
                <AutocompleteAddress
                  id={fields.pickupAddress.id}
                  onSelect={(address) => {
                    form.update({ name: fields.pickupAddress.name, value: address });
                  }}
                  inputProps={getInputProps(fields.pickupAddress, {
                    type: "text",
                    ariaAttributes: true,
                  })}
                  className={fields.pickupAddress.errors ? ERROR_RING_CLASSES : ""}
                />
                <FieldError errors={fields.pickupAddress.errors} />
              </div>

              <div className="space-y-1">
                <input
                  type="hidden"
                  name={fields.sameLocation.name}
                  value={sameLocationChecked ? "true" : "false"}
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`${fields.sameLocation.id}-ctrl`}
                    checked={sameLocationChecked}
                    onCheckedChange={handleSameLocationChange}
                    aria-label="Drop-off location same as pickup"
                  />
                  <Label htmlFor={`${fields.sameLocation.id}-ctrl`} className="cursor-pointer">
                    Drop-off location same as pickup
                  </Label>
                </div>
                <FieldError errors={fields.sameLocation.errors} />
              </div>

              {!sameLocationChecked && (
                <div className="space-y-1">
                  <Label htmlFor={fields.dropOffAddress.id} className="font-semibold">
                    Drop-off Address
                  </Label>
                  <AutocompleteAddress
                    id={fields.dropOffAddress.id}
                    onSelect={(address) => {
                      form.update({ name: fields.dropOffAddress.name, value: address });
                    }}
                    inputProps={getInputProps(fields.dropOffAddress, {
                      type: "text",
                      ariaAttributes: true,
                    })}
                    className={fields.dropOffAddress.errors ? ERROR_RING_CLASSES : ""}
                  />
                  <FieldError errors={fields.dropOffAddress.errors} />
                </div>
              )}

              {fuelNote && (
                <div
                  className="bg-green-50 border-l-4 border-green-400 text-green-800 p-2 text-sm"
                  role="alert"
                >
                  <span className="font-bold">Fuel included:</span> {fuelNote}
                </div>
              )}

              {/* Fuel upgrade option - only show for 1-2 DAY bookings */}
              {totalDays > 0 && totalDays <= 2 && bookingType === DAY_BOOKING_TYPE && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requiresFullTank"
                      checked={requiresFullTank}
                      onCheckedChange={handleFullTankChange}
                    />
                    <Label htmlFor="requiresFullTank" className="cursor-pointer">
                      Upgrade to full tank (+{formatCurrency(Number(car.fuelUpgradeRate))})
                    </Label>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeSecurityDetail"
                    checked={includeSecurityDetail}
                    onCheckedChange={handleSecurityDetailChange}
                  />
                  <Label htmlFor="includeSecurityDetail" className="cursor-pointer">
                    Add security detail (+{formatCurrency(securityDetailRate)} /{" "}
                    {BOOKING_TYPE_LABELS[bookingType].perUnit})
                  </Label>
                </div>
              </div>

              {/* Booking Credits Section */}
              {user && bookingCredits && bookingCredits.availableCredits > 0 && (
                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-blue-800">
                      Available Credit: {formatCurrency(bookingCredits.availableCredits)}
                    </div>
                    {bookingCredits.availableCredits > bookingCredits.maxCreditsPerBooking && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600">
                          (Max per booking: {formatCurrency(bookingCredits.maxCreditsPerBooking)})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-blue-200">
                    <Label
                      htmlFor="applyCredits"
                      className="text-sm text-blue-700 cursor-pointer font-bold"
                    >
                      Apply{" "}
                      {formatCurrency(
                        Math.min(
                          bookingCredits.availableCredits,
                          subtotalBeforeDiscounts - referralDiscountAmount,
                          bookingCredits.maxCreditsPerBooking,
                        ),
                      )}{" "}
                      credit
                    </Label>
                    <Switch
                      id="applyCredits"
                      checked={useCreditsAmount > 0}
                      onCheckedChange={(checked) => handleUseCreditsChange(checked, bookingCredits)}
                      disabled={bookingCredits.availableCredits === 0}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        )}

        {hasValidBookingType && carIsAvailableToBook && (
          <CardFooter className="flex flex-col items-stretch space-y-4 bg-gray-50 p-4 border-t">
            <div className="w-full">
              <h3 className="text-base flex items-center space-x-2 gap-2 font-medium mb-2">
                {/* <CreditCard className="h-5 w-5 text-blue-600" /> */}
                Cost Breakdown
              </h3>
              <dl className="text-sm transition-all duration-200">
                <div className="flex justify-between mb-1.5">
                  <dt className="text-gray-600">
                    {formatCurrency(currentCarPrice)} &times; {totalDays}
                    {` ${
                      totalDays === 1
                        ? BOOKING_TYPE_LABELS[bookingType].singular
                        : BOOKING_TYPE_LABELS[bookingType].plural
                    }`}
                  </dt>
                  <dd className="text-gray-800">{formatCurrency(baseTotal)}</dd>
                </div>
                <div
                  className={`flex justify-between transition-all duration-200 ease-out ${
                    includeSecurityDetail
                      ? "opacity-100 h-6 mb-1.5"
                      : "opacity-0 h-0 mb-0 overflow-hidden"
                  }`}
                >
                  <dt className="text-gray-600">
                    + Security Detail &times; {totalDays}{" "}
                    {totalDays === 1
                      ? BOOKING_TYPE_LABELS[bookingType].singular
                      : BOOKING_TYPE_LABELS[bookingType].plural}
                  </dt>
                  <dd className="text-gray-800">{formatCurrency(securityDetailTotalCost)}</dd>
                </div>
                <div
                  className={`flex justify-between transition-all duration-200 ease-out ${
                    fuelUpgradeCost > 0
                      ? "opacity-100 h-6 mb-1.5"
                      : "opacity-0 h-0 mb-0 overflow-hidden"
                  }`}
                >
                  <dt className="text-gray-600">Fuel Upgrade to Full Tank</dt>
                  <dd className="text-gray-800">{formatCurrency(fuelUpgradeCost)}</dd>
                </div>
                {platformFee > 0 && (
                  <div className="flex justify-between mb-1.5">
                    <dt className="text-gray-600">
                      Platform Fee ({platformServiceFeeRate.toFixed(1)}%)
                    </dt>
                    <dd className="text-gray-800">{formatCurrency(platformFee)}</dd>
                  </div>
                )}
                {/* <hr className="border-t border-gray-200 my-2" /> */}
                {/* <div className="flex justify-between mb-1.5">
                  <dt className="text-gray-600">Subtotal Before Discounts</dt>
                  <dd className="text-gray-800">{formatCurrency(subtotalBeforeDiscounts)}</dd>
                </div> */}
                <div
                  className={`flex justify-between transition-all duration-200 ease-out ${
                    referralDiscountAmount > 0
                      ? "opacity-100 h-6 mb-1.5"
                      : "opacity-0 h-0 mb-0 overflow-hidden"
                  }`}
                >
                  <dt className="text-green-600">Referral Discount</dt>
                  <dd className="text-green-600 font-medium">
                    -{formatCurrency(referralDiscountAmount)}
                  </dd>
                </div>
                <div
                  className={`flex justify-between transition-all duration-200 ease-out ${
                    useCreditsAmount > 0
                      ? "opacity-100 h-6 mb-1.5"
                      : "opacity-0 h-0 mb-0 overflow-hidden"
                  }`}
                >
                  <dt className="text-blue-600">Booking Credits</dt>
                  <dd className="text-blue-600 font-medium">-{formatCurrency(useCreditsAmount)}</dd>
                </div>
                {/* <div className="flex justify-between mb-1.5">
                  <dt className="text-gray-600">Subtotal After Discounts</dt>
                  <dd className="text-gray-800">{formatCurrency(subtotalAfterDiscounts)}</dd>
                </div> */}
                <div className="flex justify-between mb-1.5">
                  <dt className="text-gray-600">VAT ({vatRate.toFixed(1)}%)</dt>
                  <dd className="text-gray-800">{formatCurrency(vat)}</dd>
                </div>
                <hr className="border-t border-gray-200 my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt> <dd>{formatCurrency(finalTotalCost)}</dd>
                </div>
              </dl>
            </div>

            {/* Only show booking section if user is not a fleet owner */}
            {(user === null ||
              !user.roles?.some((role) =>
                ["fleetOwner", "admin", "staff"].includes(role.name),
              )) && (
              <div className="space-y-4 pt-4 border-t">
                {!user && "name" in fields && "email" in fields && "phoneNumber" in fields && (
                  <>
                    <h3 className="text-md font-semibold">Guest Details</h3>
                    <GuestInfoFields
                      nameField={fields.name as FieldMetadata<string>}
                      emailField={fields.email as FieldMetadata<string>}
                      phoneNumberField={fields.phoneNumber as FieldMetadata<string>}
                    />
                  </>
                )}

                <div className="flex flex-col space-y-2">
                  {!user ? (
                    <>
                      <Button
                        type="submit"
                        className="rounded w-full"
                        name="intent"
                        value="guest"
                        disabled={isPending}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Redirecting to payment...
                          </>
                        ) : (
                          "Pay Now as Guest"
                        )}
                      </Button>
                      <div className="flex items-center justify-center text-sm pt-1">
                        <span>Have an account?</span>
                        <Button
                          type="button"
                          variant="link"
                          className="underline px-1"
                          disabled={isPending}
                          onClick={() => {
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

                            currentParams.set(
                              "sameLocation",
                              sameLocationChecked ? "true" : "false",
                            );

                            if (!sameLocationChecked && fields.dropOffAddress.value) {
                              currentParams.set("dropOffAddress", fields.dropOffAddress.value);
                            }

                            if (
                              fields.pickupTime.value &&
                              (bookingType === DAY_BOOKING_TYPE ||
                                bookingType === FULL_DAY_BOOKING_TYPE)
                            ) {
                              currentParams.set("pickupTime", fields.pickupTime.value);
                            }

                            currentParams.set("bookingType", bookingType);
                            currentParams.set("role", "user");

                            currentParams.set("requiresFullTank", String(requiresFullTank));

                            const redirectTo = `/cars/${car.id}?${currentParams.toString()}`;
                            navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
                          }}
                        >
                          Sign in to book
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      type="submit"
                      className="rounded w-full"
                      name="intent"
                      value="auth"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting to payment...
                        </>
                      ) : (
                        "Pay Now"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </Form>
  );
}
