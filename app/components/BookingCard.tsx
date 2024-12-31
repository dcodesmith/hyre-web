import { Car } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Form, useSearchParams, useSubmit } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { useCallback, useState } from "react";
import { DateRange } from "react-day-picker";
import { formatCurrency, useIsPending } from "~/lib/utils";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const config = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

const hasTimePassed = (selectedDate: Date, hour: number) => {
  const now = new Date();
  const isSameDay = selectedDate.toLocaleDateString() === now.toLocaleDateString();

  return isSameDay && now.getHours() >= hour;
};

function getPickupTimes(date: Date) {
  return ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"]
    .filter((time) => !hasTimePassed(date, Number.parseInt(time.split(":")[0])))
    .map((time) => ({
      label: time,
      value: time,
    }));
}

type BookingCardProps = {
  car: Car;
  isAvailable: boolean;
};

export default function BookingCard({ car, isAvailable }: BookingCardProps) {
  const [sameLocation, setSameLocation] = useState<CheckedState>(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const isPending = useIsPending();
  const submit = useSubmit();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
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
    amount: 3000,
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
    <Form onSubmit={onMakePayment}>
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
                <Select name="pickupTime">
                  <SelectTrigger id="pickupTime" className="w-full rounded">
                    <SelectValue placeholder="When would you like to be picked up?" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPickupTimes(dateRange.from).map(({ label, value }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pickupStreet">Pickup Street Address</Label>
                <Input
                  id="pickupStreet"
                  name="pickupStreet"
                  placeholder="Enter street address"
                  className="w-full rounded"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pickupLocality">Pickup Locality/Area</Label>
                <Input
                  id="pickupLocality"
                  name="pickupLocality"
                  placeholder="Enter locality or area"
                  className="w-full rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameLocation"
                    name="sameLocation"
                    checked={sameLocation}
                    onCheckedChange={setSameLocation}
                  />
                  <Label htmlFor="sameLocation">Drop-off location same as pickup</Label>
                </div>
              </div>

              {!sameLocation && (
                <>
                  <div className="space-y-1" id="dropoffFields">
                    <Label htmlFor="dropOffStreet">Drop-off Street Address</Label>
                    <Input
                      id="dropOffStreet"
                      name="dropOffStreet"
                      placeholder="Enter drop-off street address"
                      className="w-full rounded"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dropOffLocality">Drop-off Locality/Area</Label>
                    <Input
                      id="dropOffLocality"
                      name="dropOffLocality"
                      placeholder="Enter drop-off locality or area"
                      className="w-full rounded"
                    />
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
