import { Booking, Car } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { formatCurrency } from "~/lib/utils";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const config = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

const hasTimePassed = (selectedDate: Date = new Date(), hour: number) => {
  const now = new Date();
  const isSameDay =
    selectedDate.toLocaleDateString() === now.toLocaleDateString();

  return isSameDay && now.getHours() >= hour;
};

function getPickupTimes(date: Date) {
  return ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"]
    .filter((time) => !hasTimePassed(date, parseInt(time.split(":")[0])))
    .map((time) => ({
      label: time,
      value: time,
    }));
}

export default function BookingCard({
  car,
  isAvailable,
}: {
  car: Car;
  isAvailable: boolean;
}) {
  const [sameLocation, setSameLocation] = useState<CheckedState>(true);
  const navigate = useNavigate();
  const fetcher = useFetcher<{ booking: Booking }>({ key: "make-booking" });
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  useEffect(() => {
    if (fetcher.data) {
      navigate(`/bookings/${fetcher.data.booking.id}`);
    }
  }, [fetcher.data, navigate]);

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
    if (
      dateRange.from.toLocaleDateString() === dateRange.to.toLocaleDateString()
    ) {
      return 1;
    }

    // Add 1 to include both the start and end dates
    const days =
      Math.ceil(
        (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 3600 * 24)
      ) + 1;

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
      // TODO: window object is undefined when the page is refreshed
      title: `${window.ENV.APP_NAME} Booking Payment`,
      description: "Payment for Booking",
      logo: "https://picsum.photos/seed/car-rental/800/600",
    },
  });

  const onMakePayment = useCallback(() => {
    if (!fetcher.data?.booking) return;

    const bookingId = fetcher.data.booking.id;

    handlePayment({
      callback: ({ transaction_id: transactionId, status }) => {
        console.log("fetcher", fetcher);
        fetcher.submit(
          { transactionId, status },
          { method: "PATCH", action: `/bookings/${bookingId}` }
        );
        closePaymentModal();
      },
      onClose: () => {},
    });
  }, [fetcher, handlePayment]);

  useEffect(() => {
    if (fetcher.data?.booking) {
      onMakePayment();
    }
  }, [fetcher.data, onMakePayment]);

  return (
    <fetcher.Form
      method="post"
      action={`/bookings/${car.id}?${searchParams.toString()}`}
    >
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
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  name="street"
                  placeholder="Enter street address"
                  className="w-full rounded"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="locality">Locality/Area</Label>
                <Input
                  id="locality"
                  name="locality"
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
                  <Label htmlFor="sameLocation">
                    Drop-off location same as pickup
                  </Label>
                </div>
              </div>

              {!sameLocation && (
                <>
                  <div className="space-y-1" id="dropoffFields">
                    <Label htmlFor="dropStreet">Drop-off Street Address</Label>
                    <Input
                      id="dropStreet"
                      name="dropStreet"
                      placeholder="Enter drop-off street address"
                      className="w-full rounded"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dropLocality">Drop-off Locality/Area</Label>
                    <Input
                      id="dropLocality"
                      name="dropLocality"
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
                  {calculateTotalDays()} days x{" "}
                  {formatCurrency(Number(car.price))}
                </div>
                <div className="text-md font-bold">
                  Total:{" "}
                  {formatCurrency(Number(car.price) * calculateTotalDays())}
                </div>
              </div>

              <Button type="submit" className="rounded">
                {fetcher.state === "submitting" ? "Submitting..." : "Book Now"}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </fetcher.Form>
  );
}
