import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ArrowLeftIcon } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getFleetCarServiceTierLabel,
  getFleetCarStatusLabel,
  getFleetCarVehicleTypeLabel,
} from "./fleet-car";
import {
  editableFleetCarStatusSchema,
  type FleetCarEditActionData,
  fleetCarEditFormSchema,
} from "./fleet-car-edit-form-schema";

type EditableFleetCar = Pick<
  FleetCar,
  | "airportPickupRate"
  | "dayRate"
  | "fullDayRate"
  | "fuelUpgradeRate"
  | "hourlyRate"
  | "id"
  | "make"
  | "model"
  | "nightRate"
  | "passengerCapacity"
  | "pricingIncludesFuel"
  | "registrationNumber"
  | "serviceTier"
  | "status"
  | "vehicleType"
  | "year"
>;

type FleetCarEditFormProps = {
  readonly actionData?: FleetCarEditActionData;
  readonly car: EditableFleetCar;
};

function errorAttributes(errors: readonly string[] | undefined, errorId: string) {
  return errors ? { "aria-describedby": errorId, "aria-invalid": true as const } : {};
}

export function FleetCarEditForm({ actionData, car }: FleetCarEditFormProps) {
  const navigation = useNavigation();
  const isSaving =
    navigation.state !== "idle" &&
    navigation.formMethod === "POST" &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname.endsWith("/edit");
  const [form, fields] = useForm({
    lastResult: actionData?.submission,
    constraint: getZodConstraint(fleetCarEditFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      dayRate: String(car.dayRate),
      hourlyRate: String(car.hourlyRate),
      nightRate: String(car.nightRate),
      fullDayRate: String(car.fullDayRate),
      airportPickupRate: String(car.airportPickupRate),
      fuelUpgradeRate: car.fuelUpgradeRate == null ? "" : String(car.fuelUpgradeRate),
      pricingIncludesFuel: car.pricingIncludesFuel ? "on" : "",
      status: car.status === "BOOKED" ? undefined : car.status,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: fleetCarEditFormSchema });
    },
  });
  const pricingIncludesFuel = useInputControl(fields.pricingIncludesFuel);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button asChild className="-ml-2 mb-3" size="sm" variant="ghost">
          <Link to={`/fleet-owner/cars/${car.id}`}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back to car
          </Link>
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Edit {car.make} {car.model}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update pricing and availability for {car.registrationNumber}.
        </p>
      </div>

      <Form method="post" {...getFormProps(form)} className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Pricing</h3>
              </CardTitle>
              <CardDescription>Set the base rates customers see for this car.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(fields.hourlyRate.errors)}>
                  <FieldLabel htmlFor={fields.hourlyRate.id}>Hourly rate</FieldLabel>
                  <Input
                    {...getInputProps(fields.hourlyRate, { type: "number" })}
                    inputMode="numeric"
                    min={1}
                  />
                  <FormError id={fields.hourlyRate.errorId} errors={fields.hourlyRate.errors} />
                </Field>

                <Field data-invalid={Boolean(fields.dayRate.errors)}>
                  <FieldLabel htmlFor={fields.dayRate.id}>Daily rate (12 hours)</FieldLabel>
                  <Input
                    {...getInputProps(fields.dayRate, { type: "number" })}
                    inputMode="numeric"
                    min={1}
                  />
                  <FormError id={fields.dayRate.errorId} errors={fields.dayRate.errors} />
                </Field>

                <Field data-invalid={Boolean(fields.nightRate.errors)}>
                  <FieldLabel htmlFor={fields.nightRate.id}>Nightly rate (11pm to 5am)</FieldLabel>
                  <Input
                    {...getInputProps(fields.nightRate, { type: "number" })}
                    inputMode="numeric"
                    min={1}
                  />
                  <FormError id={fields.nightRate.errorId} errors={fields.nightRate.errors} />
                </Field>

                <Field data-invalid={Boolean(fields.fullDayRate.errors)}>
                  <FieldLabel htmlFor={fields.fullDayRate.id}>Full day rate (24 hours)</FieldLabel>
                  <Input
                    {...getInputProps(fields.fullDayRate, { type: "number" })}
                    inputMode="numeric"
                    min={1}
                  />
                  <FormError id={fields.fullDayRate.errorId} errors={fields.fullDayRate.errors} />
                </Field>

                <Field data-invalid={Boolean(fields.airportPickupRate.errors)}>
                  <FieldLabel htmlFor={fields.airportPickupRate.id}>Airport pickup rate</FieldLabel>
                  <Input
                    {...getInputProps(fields.airportPickupRate, { type: "number" })}
                    inputMode="numeric"
                    min={1}
                  />
                  <FormError
                    id={fields.airportPickupRate.errorId}
                    errors={fields.airportPickupRate.errors}
                  />
                </Field>

                <Field orientation="horizontal" className="h-9 self-end">
                  <input
                    type="hidden"
                    name={fields.pricingIncludesFuel.name}
                    value={pricingIncludesFuel.value ?? ""}
                  />
                  <Checkbox
                    key={fields.pricingIncludesFuel.key}
                    id={fields.pricingIncludesFuel.id}
                    checked={pricingIncludesFuel.value === "on"}
                    onBlur={pricingIncludesFuel.blur}
                    onCheckedChange={(checked) =>
                      pricingIncludesFuel.change(checked === true ? "on" : "")
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={fields.pricingIncludesFuel.id}>
                      Pricing includes fuel
                    </FieldLabel>
                  </FieldContent>
                </Field>

                {pricingIncludesFuel.value === "on" ? (
                  <input type="hidden" name={fields.fuelUpgradeRate.name} value="" />
                ) : (
                  <Field
                    data-invalid={Boolean(fields.fuelUpgradeRate.errors)}
                    className="sm:col-span-2"
                  >
                    <FieldLabel htmlFor={fields.fuelUpgradeRate.id}>Fuel upgrade rate</FieldLabel>
                    <Input
                      {...getInputProps(fields.fuelUpgradeRate, { type: "number" })}
                      inputMode="numeric"
                      min={1}
                      placeholder="Required when fuel is not included"
                    />
                    <FormError
                      id={fields.fuelUpgradeRate.errorId}
                      errors={fields.fuelUpgradeRate.errors}
                    />
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Availability</h3>
                </CardTitle>
                <CardDescription>Control whether this car can accept bookings.</CardDescription>
              </CardHeader>
              <CardContent>
                {car.status === "BOOKED" ? (
                  <p className="text-sm text-muted-foreground">
                    This car is currently booked. Its availability cannot be changed.
                  </p>
                ) : (
                  <Field data-invalid={Boolean(fields.status.errors)}>
                    <FieldLabel htmlFor={fields.status.id}>Current status</FieldLabel>
                    <Select
                      key={fields.status.key}
                      name={fields.status.name}
                      defaultValue={fields.status.initialValue ?? car.status}
                    >
                      <SelectTrigger
                        id={fields.status.id}
                        className="w-full"
                        {...errorAttributes(fields.status.errors, fields.status.errorId)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editableFleetCarStatusSchema.options.map((value) => (
                          <SelectItem key={value} value={value}>
                            {getFleetCarStatusLabel(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError id={fields.status.errorId} errors={fields.status.errors} />
                  </Field>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Vehicle profile</h3>
                </CardTitle>
                <CardDescription>These details are fixed after onboarding.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Vehicle type</dt>
                    <dd className="mt-1 font-medium">
                      {getFleetCarVehicleTypeLabel(car.vehicleType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Service tier</dt>
                    <dd className="mt-1 font-medium">
                      {getFleetCarServiceTierLabel(car.serviceTier)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Passenger capacity</dt>
                    <dd className="mt-1 font-medium">
                      {car.passengerCapacity} passenger
                      {car.passengerCapacity === 1 ? "" : "s"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        <FormError id={form.errorId} errors={form.errors} />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link to={`/fleet-owner/cars/${car.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
