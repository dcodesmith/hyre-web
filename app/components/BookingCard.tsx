import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { Car, User } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import { Form, useNavigate, useSearchParams } from "@remix-run/react";
import { DateRange } from "react-day-picker";
import { z } from "zod";
import { useBookingPayment } from "~/hooks/usePayment";
import { formatCurrency } from "~/lib/utils";
import { AutocompleteAddress } from "./AutocompleteAddress";
import { BookingTimeSelect } from "./BookingTimeSelect";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";

// FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X
// Public Key FLWPUBK_TEST-643bc7a3d329e2cd19277bc263cca008-X

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
  pickupAddress: z.string({
    required_error: "Pickup address is required",
  }),
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
});

const bookingUnselectedSchema = z.object({
  carId: z.string(),
  sameLocation: z.literal("false"),
  pickupTime: z.string({
    required_error: "Pickup time is required",
  }),
  pickupAddress: z.string({
    required_error: "Pickup address is required",
  }),
  dropOffAddress: z.string({
    required_error: "Drop-off address is required",
  }),
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
});

const emailSchema = z
  .string({
    required_error: "Email is required for guest booking",
  })
  .email("Invalid email address");

const nameSchema = z
  .string({
    required_error: "Name is required for guest booking",
  })
  .min(2, "Name must be at least 2 characters");

const phoneSchema = z
  .string({
    required_error: "Phone number is required for guest booking",
  })
  .min(10, "Phone number must be at least 10 digits");

const getBookingSchema = (isGuestBooking: boolean) => {
  const baseSchemas = {
    selected: bookingSelectedSchema,
    unselected: bookingUnselectedSchema,
  };

  if (!isGuestBooking) {
    return z.discriminatedUnion("sameLocation", [baseSchemas.selected, baseSchemas.unselected]);
  }

  return z.discriminatedUnion("sameLocation", [
    baseSchemas.selected.extend({
      email: emailSchema,
      name: nameSchema,
      phone: phoneSchema,
    }),
    baseSchemas.unselected.extend({
      email: emailSchema,
      name: nameSchema,
      phone: phoneSchema,
    }),
  ]);
};

const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

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

// Add security detail cost constant
const SECURITY_DETAIL_COST = 30000;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export default function BookingCard({ car, isAvailable, user }: BookingCardProps) {
  const navigate = useNavigate();
  const [sameLoc, setSameLocation] = useState<CheckedState>(true);
  const [includeSecurityDetail, setIncludeSecurityDetail] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  });

  const [form, { pickupTime, pickupAddress, dropOffAddress, sameLocation, email, name, phone }] =
    useForm({
      shouldValidate: "onSubmit",
      shouldRevalidate: "onBlur",
      defaultValue: {
        pickupTime: searchParams.get("pickupTime") || undefined,
        pickupAddress: searchParams.get("pickupAddress") || undefined,
        dropOffAddress: searchParams.get("dropOffAddress") || undefined,
        sameLocation: searchParams.get("sameLocation") || "true",
      },
      onSubmit(event) {
        onMakePayment(event);
      },
      onValidate({ formData, form }) {
        const isGuestBooking = form.getAttribute("data-booking-type") === "guest";
        const schema = getBookingSchema(isGuestBooking);
        return parseWithZod(formData, { schema });
      },
    });

  const totalDays = calculateTotalDays(dateRange);
  const totalCost =
    (Number(car.price) * totalDays +
      (includeSecurityDetail ? SECURITY_DETAIL_COST * totalDays : 0)) *
    1.075;

  const onMakePayment = useBookingPayment({
    car,
    totalCost,
    customer: {
      email: email.value ?? "",
      name: name.value ?? "",
      phone_number: phone.value ?? "",
    },
    searchParams: searchParams.toString(),
    user,
  });

  const carIsAvailableToBook = dateRange.from && dateRange.to && isAvailable;

  const handleSelect = (place: google.maps.places.PlaceResult) => setSelectedPlace(place);

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

  return (
    <Form {...getFormProps(form)} method="POST" autoComplete="off">
      <input type="hidden" name="carId" value={car.id} />
      <Card className="rounded sticky top-4 shadow-xl inset-shadow-sm">
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
                <Label htmlFor={pickupAddress.id}>Pickup Address</Label>

                <AutocompleteAddress
                  onSelect={handleSelect}
                  inputProps={getInputProps(pickupAddress, { type: "text" })}
                  className={`${pickupAddress.errors ? errorRingClasses : ""}`}
                />
                {pickupAddress.errors && (
                  <p className="text-red-500 text-sm">{pickupAddress.errors.join(" ")}</p>
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
                <div className="space-y-1">
                  <Label htmlFor={dropOffAddress.id}>Drop-off Address</Label>
                  <AutocompleteAddress
                    onSelect={handleSelect}
                    inputProps={getInputProps(dropOffAddress, { type: "text" })}
                    className={`${dropOffAddress.errors ? errorRingClasses : ""}`}
                  />
                  {dropOffAddress.errors && (
                    <p className="text-red-500 text-sm">{dropOffAddress.errors.join(" ")}</p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeSecurityDetail"
                    checked={includeSecurityDetail}
                    onCheckedChange={(checked) => setIncludeSecurityDetail(!!checked)}
                  />
                  <Label htmlFor="includeSecurityDetail">Add security detail</Label>
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

                  {includeSecurityDetail && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">
                        {formatCurrency(SECURITY_DETAIL_COST)} x {totalDays} days
                      </dt>
                      <dd className="text-sm text-gray-600">
                        {formatCurrency(SECURITY_DETAIL_COST * totalDays)}
                      </dd>
                    </div>
                  )}

                  <div className="flex justify-between mb-4">
                    <dt className="text-sm text-gray-600">VAT @ 7.5%</dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(
                        (Number(car.price) * totalDays +
                          (includeSecurityDetail ? SECURITY_DETAIL_COST * totalDays : 0)) *
                          0.075,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Platform Service Fee</dt>
                    <dd className="text-sm text-gray-600">
                      {formatCurrency(
                        (Number(car.price) * totalDays +
                          (includeSecurityDetail ? SECURITY_DETAIL_COST * totalDays : 0)) *
                          0.15,
                      )}
                    </dd>
                  </div>

                  <hr className="border-t border-gray-200" />

                  <div className="flex justify-between mt-4">
                    <dt className="text-md font-bold">Total</dt>
                    <dd className="text-md font-bold">
                      {formatCurrency(
                        totalCost +
                          (Number(car.price) * totalDays +
                            (includeSecurityDetail ? SECURITY_DETAIL_COST * totalDays : 0)) *
                            0.15,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {(!user || user.roles.some((role) => role.name === "user")) && (
                <div className="space-y-4">
                  {!user && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor={name.id}>Name</Label>
                        <Input
                          {...getInputProps(name, { type: "text" })}
                          placeholder="Enter your full name"
                          className={`w-full rounded ${name.errors ? errorRingClasses : ""}`}
                        />
                        {name.errors && (
                          <p className="text-red-500 text-sm">{name.errors.join(" ")}</p>
                        )}
                      </div>
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
                      <div className="space-y-1">
                        <Label htmlFor={phone.id}>Phone Number</Label>
                        <Input
                          {...getInputProps(phone, { type: "tel" })}
                          placeholder="Enter your phone number"
                          className={`w-full rounded ${phone.errors ? errorRingClasses : ""}`}
                        />
                        {phone.errors && (
                          <p className="text-red-500 text-sm">{phone.errors.join(" ")}</p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex flex-col space-y-2">
                    {!user ? (
                      <>
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
                        <div className="flex items-center">
                          <span>Have an account?</span>
                          <Button
                            type="button"
                            className="underline"
                            form={form.id}
                            variant="link"
                            onClick={() => {
                              searchParams.append("role", "user");
                              const redirectTo = `/cars/${car.id}${
                                searchParams ? `?${searchParams}` : ""
                              }`;
                              return navigate(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`);
                              // const formElement = document.getElementById(
                              //   form.id,
                              // ) as HTMLFormElement;
                              // formElement.setAttribute("data-booking-type", "auth");
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
                        form={form.id}
                        onClick={() => {
                          const formElement = document.getElementById(form.id) as HTMLFormElement;
                          formElement.setAttribute("data-booking-type", "auth");
                        }}
                      >
                        Book Now
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
