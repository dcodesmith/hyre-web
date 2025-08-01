import { type FieldMetadata, getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import type { Car, User } from "@prisma/client";
import { useNavigate, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import { eachDayOfInterval, format, isAfter, parseISO, startOfDay } from "date-fns";
import { CreditCard, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { formatCurrency } from "~/lib/utils";
import { AutocompleteAddress } from "../AutocompleteAddress";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { BookingTimeSelect } from "./BookingTimeSelect";
import { DateRangePicker } from "./DateRangePicker";

const SECURITY_DETAIL_COST = 30000;
const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

type BookingCardProps = {
  car: Car;
  isAvailable: boolean;
  user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  vatRate: number;
  platformServiceFeeRate: number;
};

const DAY_BOOKING_TYPE = "DAY" as const;
const NIGHT_BOOKING_TYPE = "NIGHT" as const;
const BOOKING_TYPE_OPTIONS = [DAY_BOOKING_TYPE, NIGHT_BOOKING_TYPE] as const;
type BookingType = (typeof BOOKING_TYPE_OPTIONS)[number];
const BOOKING_TYPE_OPTIONS_MAP = {
  [DAY_BOOKING_TYPE]: (
    <span className="font-medium text-sm">
      Day <span className="text-xs text-gray-600">(12hr)</span>
    </span>
  ),
  [NIGHT_BOOKING_TYPE]: (
    <span className="font-medium text-sm">
      Night <span className="text-xs text-gray-600">(6hr)</span>
    </span>
  ),
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
      data.bookingType === DAY_BOOKING_TYPE &&
      (!data.pickupTime || data.pickupTime.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup time is required for daytime bookings",
        path: ["pickupTime"],
      });
    }
  });
};

const calculateTotalDays = (
  from: Date | undefined,
  to: Date | undefined,
  bookingType?: BookingType,
): number => {
  if (!from || !to || isAfter(from, to)) {
    return 0;
  }

  // For night bookings, calculate the number of nights (each night spans 2 calendar days)
  if (bookingType === NIGHT_BOOKING_TYPE) {
    const start = startOfDay(from);
    const end = startOfDay(to);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // For night bookings, each night spans from one day to the next
    // So if user selects 1st and 2nd, that's 1 night
    // If user selects 1st and 3rd, that's 2 nights
    return Math.max(1, daysDiff);
  }

  // For day bookings, use the existing logic
  const start = startOfDay(from);
  const end = startOfDay(to);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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

function FieldError({ errors }: { errors?: string[] }) {
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

export default function BookingCard({
  car,
  isAvailable = false,
  user,
  vatRate,
  platformServiceFeeRate,
}: BookingCardProps) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookingType, setBookingType] = useState<BookingType>(
    (searchParams.get("bookingType") as BookingType | null) || DAY_BOOKING_TYPE,
  );
  const navigation = useNavigation();
  const isPending = navigation.state === "submitting" && navigation.formMethod === "POST";

  const [sameLocationChecked, setSameLocationChecked] = useState<boolean>(
    searchParams.get("sameLocation") !== "false",
  );
  const [includeSecurityDetail, setIncludeSecurityDetail] = useState(false);

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
    () => calculateTotalDays(dateRange.from, dateRange.to, bookingType),
    [dateRange.from, dateRange.to, bookingType],
  );

  const currentCarPrice =
    bookingType === NIGHT_BOOKING_TYPE ? Number(car.nightRate) : Number(car.dayRate);

  const baseTotal = useMemo(() => currentCarPrice * totalDays, [currentCarPrice, totalDays]);
  const securityDetailTotalCost = useMemo(
    () => (includeSecurityDetail ? SECURITY_DETAIL_COST * totalDays : 0),
    [includeSecurityDetail, totalDays],
  );

  const subtotal = useMemo(
    () => baseTotal + securityDetailTotalCost,
    [baseTotal, securityDetailTotalCost],
  );

  const platformFee = useMemo(
    () => subtotal * (platformServiceFeeRate / 100),
    [subtotal, platformServiceFeeRate],
  );

  const subtotalBeforeVat = useMemo(() => subtotal + platformFee, [subtotal, platformFee]);

  const vat = useMemo(() => subtotalBeforeVat * (vatRate / 100), [subtotalBeforeVat, vatRate]);

  const finalTotalCost = useMemo(() => subtotalBeforeVat + vat, [subtotalBeforeVat, vat]);

  const carIsAvailableToBook = useMemo(
    () => !!dateRange.from && !!dateRange.to && totalDays > 0 && isAvailable,
    [dateRange.from, dateRange.to, totalDays, isAvailable],
  );

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
      email: user?.email ?? searchParams.get("email") ?? "",
      name: user?.name ?? searchParams.get("name") ?? "",
      phoneNumber: user?.phoneNumber ?? searchParams.get("phoneNumber") ?? "",
      bookingType,
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

  const handleBookingTypeChange = useCallback(
    (value: BookingType) => {
      setBookingType(value);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("bookingType", value);

      if (value === NIGHT_BOOKING_TYPE) {
        newSearchParams.delete("pickupTime");
      }

      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  const nightBookingHelperText = useMemo(() => {
    if (bookingType !== NIGHT_BOOKING_TYPE || !dateRange.from || !dateRange.to || totalDays <= 0) {
      return null;
    }

    const nights = totalDays;
    const daysArr = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const daysStr = daysArr.map((d) => `${format(d, "MMM")} ${getOrdinal(d.getDate())}`).join(", ");
    return `All overnight bookings start at 11pm and end at 5am. Booking for ${nights} night${nights > 1 ? "s" : ""} (${daysStr}).`;
  }, [bookingType, dateRange.from, dateRange.to, totalDays]);

  return (
    <Form {...getFormProps(form)} method="POST" autoComplete="off">
      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="totalAmount" value={finalTotalCost} />
      <input type="hidden" name="includeSecurityDetail" value={String(includeSecurityDetail)} />

      <Card className="rounded sticky top-4 shadow-xl inset-shadow-sm">
        <CardHeader>
          <CardTitle>
            <span className="text-lg">
              {totalDays > 0 ? (
                <>
                  {formatCurrency(currentCarPrice)}
                  <span className="text-sm text-gray-500 font-normal">
                    {" "}
                    per {bookingType.toLowerCase()}
                  </span>
                </>
              ) : (
                "Select dates"
              )}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="font-semibold">Booking Type</Label>
            <RadioGroup
              value={bookingType}
              onValueChange={handleBookingTypeChange}
              className="space-x-2 grid grid-cols-2"
              {...getInputProps(fields.bookingType, { type: "radio", value: bookingType })}
            >
              {BOOKING_TYPE_OPTIONS.map((type) => (
                <Label
                  key={type}
                  className="flex items-center space-x-2 cursor-pointer p-2 border rounded has-[:checked]:bg-muted has-[:checked]:border-primary transition-colors"
                >
                  <RadioGroupItem value={type} id={`booking-type-${type}`} />
                  {BOOKING_TYPE_OPTIONS_MAP[type]}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${form.id}-daterange`} className="font-semibold">
              Select Dates
            </Label>
            <DateRangePicker
              isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
              date={dateRange}
              onDateChange={handleDateChange}
              onOpenChange={setIsDatePickerOpen}
            />
          </div>

          {totalDays > 0 && !isAvailable && (
            <div className="text-red-600 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-center">
              Car not available for the selected dates.{" "}
            </div>
          )}

          {carIsAvailableToBook && (
            <div className="w-full space-y-4 pt-4 border-t">
              {bookingType === DAY_BOOKING_TYPE ? (
                <div className="space-y-1">
                  <Label htmlFor={fields.pickupTime.id} className="font-semibold">
                    Pickup Time
                  </Label>
                  <BookingTimeSelect
                    date={dateRange.from!}
                    {...getInputProps(fields.pickupTime, { type: "text", ariaAttributes: true })}
                    className={fields.pickupTime.errors ? ERROR_RING_CLASSES : ""}
                  />
                  <FieldError errors={fields.pickupTime.errors} />
                </div>
              ) : (
                <Input value="11:00 PM" {...getInputProps(fields.pickupTime, { type: "hidden" })} />
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
                    form.update({ name: fields.pickupAddress.name!, value: address });
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
                      form.update({ name: fields.dropOffAddress.name!, value: address });
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
              {/* <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeSecurityDetail"
                    checked={includeSecurityDetail}
                    onCheckedChange={(checked) => setIncludeSecurityDetail(!!checked)}
                  />
                  <Label htmlFor="includeSecurityDetail" className="cursor-pointer">
                    Add security detail (+{formatCurrency(SECURITY_DETAIL_COST)} / day)
                  </Label>
                </div>
              </div> */}
            </div>
          )}
        </CardContent>

        {carIsAvailableToBook && (
          <CardFooter className="flex flex-col items-stretch space-y-4 bg-gray-50 p-4 border-t">
            <div className="w-full">
              <h3 className="text-base flex items-center space-x-2 gap-2 font-semibold mb-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Cost Breakdown
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">
                    {formatCurrency(currentCarPrice)} &times; {totalDays}
                    {totalDays === 1
                      ? ` ${bookingType.toLowerCase()}`
                      : bookingType === NIGHT_BOOKING_TYPE
                        ? " nights"
                        : " days"}
                  </dt>
                  <dd className="text-gray-800">{formatCurrency(baseTotal)}</dd>
                </div>
                {includeSecurityDetail && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">
                      Security Detail &times; {totalDays} {totalDays === 1 ? "day" : "days"}
                    </dt>
                    <dd className="text-gray-800">{formatCurrency(securityDetailTotalCost)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-600">
                    Platform Fee ({platformServiceFeeRate.toFixed(1)}%)
                  </dt>
                  <dd className="text-gray-800">{formatCurrency(platformFee)}</dd>
                </div>
                <div className="flex justify-between">
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
                {!user && (
                  <>
                    <h3 className="text-md font-semibold">Guest Details</h3>
                    <GuestInfoFields
                      nameField={fields.name}
                      emailField={fields.email}
                      phoneNumberField={fields.phoneNumber}
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

                            if (fields.pickupTime.value && bookingType === DAY_BOOKING_TYPE) {
                              currentParams.set("pickupTime", fields.pickupTime.value);
                            }

                            currentParams.set("bookingType", bookingType);
                            currentParams.set("role", "client");

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
