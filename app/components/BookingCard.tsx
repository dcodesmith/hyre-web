import { Car, User } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Form, useSearchParams, useSubmit, useNavigate } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { useCallback, useState } from "react";
import { DateRange } from "react-day-picker";
import { formatCurrency, useIsPending } from "~/lib/utils";
import { BookingTimeSelect } from "./BookingTimeSelect";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { parseWithZod } from "@conform-to/zod";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { z } from "zod";

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
});

const bookingSchema = z.discriminatedUnion("sameLocation", [
  bookingSelectedSchema,
  bookingUnselectedSchema,
]);

const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

export default function BookingCard({ car, isAvailable, user }: BookingCardProps) {
  const navigate = useNavigate();
  const [sameLoc, setSameLocation] = useState<CheckedState>(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const isPending = useIsPending();
  const submit = useSubmit();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  const [
    form,
    { pickupTime, pickupStreet, pickupLocality, sameLocation, dropOffStreet, dropOffLocality },
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
      return parseWithZod(formData, { schema: bookingSchema });
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

  const calculateTotalDays = () => {
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

  const handlePayment = useFlutterwave({
    ...config,
    amount: Number(car.price) * calculateTotalDays(),
    customer: {
      email: "dcodesmith@gmail.com",
      phone_number: "070********",
      name: "Afees Adedamola Kolawole",
    },
    customizations: {
      // TODO: window object is undefined when the page is refreshed ${window.ENV.APP_NAME}
      title: "Booking Payment",
      description: "Payment for Booking",
      logo: "https://picsum.photos/seed/car-rental/800/600",
    },
  });

  const onMakePayment = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget as HTMLFormElement);

      const pickupTime = String(formData.get("pickupTime"));
      const pickupStreet = String(formData.get("pickupStreet"));
      const pickupLocality = String(formData.get("pickupLocality"));
      const sameLocation = String(formData.get("sameLocation"));

      if (sameLocation === "true") {
        searchParams.set("dropOffStreet", pickupStreet);
        searchParams.set("dropOffLocality", pickupLocality);
      }

      searchParams.set("role", "user");
      searchParams.set("pickupTime", pickupTime);
      searchParams.set("pickupStreet", pickupStreet);
      searchParams.set("pickupLocality", pickupLocality);
      searchParams.set("sameLocation", sameLocation);

      const searchString = searchParams.toString();

      if (!user) {
        const redirectTo = `/cars/${car.id}${searchString ? `?${searchString}` : ""}`;
        return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
      }

      handlePayment({
        callback: ({ transaction_id: transactionId, status }) => {
          formData.set("paymentId", String(transactionId));
          formData.set("status", status);

          submit(formData, {
            method: "POST",
            action: `/bookings?${searchParams.toString()}`,
          });

          setTimeout(() => {
            closePaymentModal();
          }, 1500);
        },
        onClose: () => closePaymentModal(),
      });
    },
    [handlePayment, searchParams, submit, navigate, user, car],
  );

  return (
    <Form {...getFormProps(form)} method="POST" className="space-y-4">
      <input type="hidden" name="carId" value={car.id} />
      <Card className="rounded sticky top-4">
        <CardHeader>
          <CardTitle className="text-lg">
            {dateRange.from && dateRange.to
              ? formatCurrency(Number(car.price))
              : "Select dates to check availability"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <DateRangePicker date={dateRange} onDateChange={onDateChange} />

          {dateRange.from && dateRange.to && isAvailable && (
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
            </div>
          )}
        </CardContent>

        <CardFooter>
          {dateRange.from && dateRange.to && !isAvailable && (
            <div className="text-red-500 mt-2">
              This car is not available for the selected dates.
            </div>
          )}

          {dateRange.from && dateRange.to && isAvailable && (
            <div className="flex flex-col w-full space-y-4">
              <div className="w-full">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price))} x {calculateTotalDays()} days
                    </dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price) * calculateTotalDays())}
                    </dd>
                  </div>

                  <div className="flex justify-between mb-4">
                    <dt className="text-sm text-gray-600">VAT (7.5%)</dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(Number(car.price) * calculateTotalDays() * 0.075)}
                    </dd>
                  </div>

                  <hr className="border-t border-gray-200" />

                  <div className="flex justify-between mt-4">
                    <dt className="text-md font-bold">Total</dt>
                    <dd className="text-md font-bold">
                      {formatCurrency(Number(car.price) * calculateTotalDays() * 1.075)}
                    </dd>
                  </div>
                </dl>
              </div>

              {(!user || user.roles.some((role) => role.name === "user")) && (
                <Button type="submit" className="rounded mr-auto w-full">
                  {isPending ? "Submitting..." : "Book Now"}
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </Form>
  );
}
