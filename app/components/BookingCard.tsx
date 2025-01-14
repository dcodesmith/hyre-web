import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { Car, User } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Form, useNavigate, useSearchParams, useSubmit } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { useCallback, useState } from "react";
import { DateRange } from "react-day-picker";
import { z } from "zod";
import { formatCurrency } from "~/lib/utils";
import { BookingTimeSelect } from "./BookingTimeSelect";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X

type FlutterwaveConfig = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: {
    email: string;
    phone_number: string;
    name: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
};

const config: Omit<FlutterwaveConfig, "amount" | "customer"> = {
  public_key: "FLWPUBK_TEST-643bc7a3d329e2cd19277bc263cca008-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    title: "Booking Payment",
    description: "Payment for Booking",
    logo: "https://picsum.photos/seed/car-rental/800/600",
  },
};

type BookingCardProps = {
  car: Car;
  isAvailable: boolean;
  user: User & { roles: { name: string }[] };
};

const bookingSelectedSchema = z.object({
  carId: z.string(),
  sameLocation: z.literal("true"),
  pickupTime: z.string({
    required_error: "Pickup time is required",
  }),
  pickupStreet: z
    .string({
      required_error: "Pickup street address is required",
    })
    .min(10, "Pickup street address must be at least 10 characters"),
  pickupLocality: z
    .string({
      required_error: "Pickup locality is required",
    })
    .min(3, "Pickup locality must be at least 3 characters"),
  email: z.string().email("Invalid email address").optional(),
});

const bookingUnselectedSchema = z.object({
  carId: z.string(),
  sameLocation: z.literal("false"),
  pickupTime: z.string({
    required_error: "Pickup time is required",
  }),
  pickupStreet: z
    .string({
      required_error: "Pickup street address is required",
    })
    .min(10, "Pickup street address must be at least 10 characters"),
  pickupLocality: z
    .string({
      required_error: "Pickup locality is required",
    })
    .min(3, "Pickup locality must be at least 3 characters"),
  dropOffStreet: z.string({
    required_error: "Drop-off street address is required",
  }),
  dropOffLocality: z.string({
    required_error: "Drop-off locality is required",
  }),
  email: z.string().email("Invalid email address").optional(),
});

const emailSchema = z
  .string({
    required_error: "Email is required for guest booking",
  })
  .email("Invalid email address");

const getBookingSchema = (isGuestBooking: boolean) => {
  const baseSchemas = {
    selected: bookingSelectedSchema,
    unselected: bookingUnselectedSchema,
  };

  if (!isGuestBooking) {
    return z.discriminatedUnion("sameLocation", [baseSchemas.selected, baseSchemas.unselected]);
  }

  return z.discriminatedUnion("sameLocation", [
    baseSchemas.selected.extend({ email: emailSchema }),
    baseSchemas.unselected.extend({ email: emailSchema }),
  ]);
};

const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

function useBookingPayment({
  car,
  dateRange,
  email,
  searchParams,
  user,
}: {
  car: Car;
  dateRange: DateRange;
  email: string;
  searchParams: string;
  user: User;
}) {
  const submit = useSubmit();
  const navigate = useNavigate();

  const handlePayment = useFlutterwave({
    ...config,
    amount: Number(car.price) * calculateTotalDays(dateRange) * 1.075,
    customer: {
      email: email || "dcodesmith@gmail.com",
      phone_number: "070********",
      name: "Afees Adedamola Kolawole",
    },
    customizations: config.customizations,
  });

  return useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formElement = event.currentTarget;
      const formData = new FormData(formElement);
      const isGuestBooking = formElement.getAttribute("data-booking-type") === "guest";

      if (!isGuestBooking && !user) {
        const redirectTo = `/cars/${car.id}${searchParams ? `?${searchParams}` : ""}`;
        return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      handlePayment({
        callback: ({ transaction_id: transactionId, status }) => {
          formData.set("paymentId", String(transactionId));
          formData.set("status", status);
          submit(formData, {
            method: "POST",
            action: `/bookings?${searchParams}`,
          });
          setTimeout(() => closePaymentModal(), 1500);
        },
        onClose: () => closePaymentModal(),
      });
    },
    [handlePayment, searchParams, submit, navigate, user, car],
  );
}

const calculateTotalDays = (dateRange: DateRange) => {
  if (!dateRange.from || !dateRange.to) {
    return 0;
  }

  // If both dates are the same day, return 1
  if (dateRange.from.toLocaleDateString() === dateRange.to.toLocaleDateString()) {
    return 1;
  }

  // Add 1 to include both the start and end dates
  const days =
    Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 3600 * 24)) + 1;

  return days;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export default function BookingCard({ car, isAvailable, user }: BookingCardProps) {
  const [sameLoc, setSameLocation] = useState<CheckedState>(true);
  const [isGuestBooking, setIsGuestBooking] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  const [
    form,
    {
      pickupTime,
      pickupStreet,
      pickupLocality,
      sameLocation,
      dropOffStreet,
      dropOffLocality,
      email,
    },
  ] = useForm({
    shouldValidate: "onSubmit",
    shouldRevalidate: "onBlur",
    defaultValue: {
      pickupTime: searchParams.get("pickupTime") || undefined,
      pickupStreet: searchParams.get("pickupStreet") || undefined,
      pickupLocality: searchParams.get("pickupLocality") || undefined,
      sameLocation: searchParams.get("sameLocation") || "true",
    },
    onSubmit(event) {
      onMakePayment(event);
    },
    onValidate({ formData }) {
      const schema = getBookingSchema(isGuestBooking);
      return parseWithZod(formData, { schema });
    },
  });

  const onDateChange = (dateRange: DateRange) => {
    setDateRange(dateRange);

    if (dateRange.from && dateRange.to) {
      const params = new URLSearchParams({
        ...Object.fromEntries(searchParams),
        from: dateRange.from.toISOString().split("T")[0],
        to: dateRange.to.toISOString().split("T")[0],
      });

      // Use replace option to prevent adding to history stack and avoid scroll reset
      // setSearchParams(params, { replace: true });
      setSearchParams(params);
    }
  };

  const onMakePayment = useBookingPayment({
    car,
    dateRange,
    email: email.value || "dcodesmith@gmail.com",
    searchParams: searchParams.toString(),
    user,
  });

  const totalDays = calculateTotalDays(dateRange);
  const carIsAvailableToBook = dateRange.from && dateRange.to && isAvailable;

  return (
    <Form {...getFormProps(form)} method="POST">
      <input type="hidden" name="carId" value={car.id} />
      <Card className="rounded sticky top-4">
        <CardHeader>
          <CardTitle>
            <span className="text-lg">
              {dateRange.from && dateRange.to ? (
                <>
                  {formatCurrency(Number(car.price))}
                  <span className="text-sm text-gray-500"> per day</span>
                </>
              ) : (
                "Select dates to check availability"
              )}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <DateRangePicker date={dateRange} onDateChange={onDateChange} />

          {carIsAvailableToBook && (
            <div className="w-full space-y-4 my-4">
              <div className="space-y-1">
                <Label htmlFor="pickupTime">Pickup Time</Label>
                <BookingTimeSelect
                  date={dateRange.from || new Date()}
                  defaultValue={searchParams.get("pickupTime") || undefined}
                  className={pickupTime.errors ? errorRingClasses : ""}
                />
                {pickupTime.errors && (
                  <p className="text-red-500 text-sm">{pickupTime.errors.join(" ")}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={pickupStreet.id}>Pickup Street Address</Label>
                <Input
                  {...getInputProps(pickupStreet, { type: "text" })}
                  placeholder="Enter street address"
                  className={`w-full rounded ${pickupStreet.errors ? errorRingClasses : ""}`}
                />
                {pickupStreet.errors && (
                  <p className="text-red-500 text-sm">{pickupStreet.errors.join(" ")}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={pickupLocality.id}>Pickup Locality/Area</Label>
                <Input
                  {...getInputProps(pickupLocality, { type: "text" })}
                  placeholder="Enter locality or area"
                  className={`w-full rounded ${pickupLocality.errors ? errorRingClasses : ""}`}
                />
                {pickupLocality.errors && (
                  <p className="text-red-500 text-sm">{pickupLocality.errors.join(" ")}</p>
                )}
              </div>

              <div className="space-y-1">
                <input type="hidden" name={sameLocation.name} value={sameLoc ? "true" : "false"} />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={sameLocation.id}
                    checked={sameLoc}
                    defaultChecked={true}
                    onCheckedChange={(checked) => {
                      setSameLocation(checked);
                      form.update({
                        name: sameLocation.name,
                        value: checked ? "true" : "false",
                      });
                    }}
                  />
                  <Label htmlFor={sameLocation.id}>Drop-off location same as pickup</Label>
                </div>
              </div>

              {!sameLoc && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor={dropOffStreet.id}>Drop-off Street Address</Label>
                    <Input
                      {...getInputProps(dropOffStreet, { type: "text" })}
                      placeholder="Enter drop-off street address"
                      className={`w-full rounded ${dropOffStreet.errors ? errorRingClasses : ""}`}
                    />
                    {dropOffStreet.errors && (
                      <p className="text-red-500 text-sm">{dropOffStreet.errors.join(" ")}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={dropOffLocality.id}>Drop-off Locality/Area</Label>
                    <Input
                      {...getInputProps(dropOffLocality, { type: "text" })}
                      placeholder="Enter drop-off locality or area"
                      className={`w-full rounded ${dropOffLocality.errors ? errorRingClasses : ""}`}
                    />
                    {dropOffLocality.errors && (
                      <p className="text-red-500 text-sm">{dropOffLocality.errors.join(" ")}</p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="guestBooking"
                    checked={isGuestBooking}
                    onCheckedChange={(checked) => setIsGuestBooking(!!checked)}
                  />
                  <Label htmlFor="guestBooking">Book as guest</Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {dateRange.from && dateRange.to && !isAvailable && (
            <div className="text-red-500 mt-2">
              This car is not available for the selected dates.
            </div>
          )}

          {carIsAvailableToBook && (
            <div className="flex flex-col w-full space-y-4">
              <div className="w-full">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price))} x {totalDays} days
                    </dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price) * totalDays)}
                    </dd>
                  </div>

                  <div className="flex justify-between mb-4">
                    <dt className="text-sm text-gray-600">VAT (7.5%)</dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price) * totalDays * 0.075)}
                    </dd>
                  </div>

                  <hr className="border-t border-gray-200" />

                  <div className="flex justify-between mt-4">
                    <dt className="text-md font-bold">Total</dt>
                    <dd className="text-md font-bold">
                      {formatCurrency(Number(car.price) * totalDays * 1.075)}
                    </dd>
                  </div>
                </dl>
              </div>

              {(!user || user.roles.some((role) => role.name === "user")) && (
                <div className="space-y-4">
                  {isGuestBooking && (
                    <div className="space-y-1">
                      <Label htmlFor={email.id}>Email</Label>
                      <Input
                        {...getInputProps(email, { type: "email" })}
                        placeholder="Enter your email"
                        className={`w-full rounded ${email.errors ? errorRingClasses : ""}`}
                      />
                      {email.errors && (
                        <p className="text-red-500 text-sm">{email.errors.join(" ")}</p>
                      )}
                    </div>
                  )}

                  <div className="flex">
                    {isGuestBooking ? (
                      <Button
                        type="submit"
                        className="rounded w-full"
                        form={form.id}
                        onClick={() => {
                          const formElement = document.getElementById(form.id) as HTMLFormElement;
                          formElement.setAttribute("data-booking-type", "guest");
                        }}
                      >
                        Book Now as Guest
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="rounded w-full"
                        form={form.id}
                        onClick={() => {
                          const formElement = document.getElementById(form.id) as HTMLFormElement;
                          formElement.setAttribute("data-booking-type", "auth");
                        }}
                      >
                        Sign in to book
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </Form>
  );
}
