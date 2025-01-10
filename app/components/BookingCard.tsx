import { Car } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Form, useSearchParams, useSubmit } from "@remix-run/react";
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

const config = {
  public_key: "FLWPUBK_TEST-643bc7a3d329e2cd19277bc263cca008-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

type BookingCardProps = {
  car: Car;
  isAvailable: boolean;
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

export default function BookingCard({ car, isAvailable }: BookingCardProps) {
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
    onSubmit(event) {
      onMakePayment(event);
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: bookingSchema });
    },
  });

  const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  const onDateChange = (dateRange: DateRange) => {
    setDateRange(dateRange);

    if (dateRange.from && dateRange.to) {
      const params = new URLSearchParams({
        ...Object.fromEntries(searchParams),
        from: dateRange.from.toISOString().split("T")[0],
        to: dateRange.to.toISOString().split("T")[0],
      });

      // Use replace option to prevent adding to history stack and avoid scroll reset
      setSearchParams(params, { replace: true });
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
    [handlePayment, searchParams, submit],
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
                <div className="flex items-center space-x-2">
                  <input
                    type="hidden"
                    name={sameLocation.name}
                    value={sameLoc ? "true" : "false"}
                  />
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
            <>
              <div className="w-full text-left">
                <div className="text-sm text-gray-600">
                  {calculateTotalDays()} days x {formatCurrency(Number(car.price))}
                </div>
                <div className="text-md font-bold">
                  Total: {formatCurrency(Number(car.price) * calculateTotalDays())}
                </div>
              </div>

              <Button type="submit" className="rounded">
                {isPending ? "Submitting..." : "Book Now"}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </Form>
  );
}
