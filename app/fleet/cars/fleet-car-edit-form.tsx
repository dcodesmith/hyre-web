import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ArrowLeftIcon } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import {
  type FleetCar,
  fleetCarServiceTierSchema,
  fleetCarVehicleTypeSchema,
} from "~/api/fleet/cars/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
      vehicleType: car.vehicleType,
      serviceTier: car.serviceTier,
      passengerCapacity: String(car.passengerCapacity),
      status: car.status === "BOOKED" ? undefined : car.status,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: fleetCarEditFormSchema });
    },
  });
  const pricingIncludesFuel = useInputControl(fields.pricingIncludesFuel);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
          {car.year} · {car.registrationNumber}
        </p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Pricing</h3>
            </CardTitle>
            <CardDescription>Set the base rates customers see for this car.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={fields.hourlyRate.id}>Hourly rate</Label>
              <Input
                {...getInputProps(fields.hourlyRate, { type: "number" })}
                inputMode="numeric"
                min={1}
              />
              <FormError id={fields.hourlyRate.errorId} errors={fields.hourlyRate.errors} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.dayRate.id}>Daily rate (12 hours)</Label>
              <Input
                {...getInputProps(fields.dayRate, { type: "number" })}
                inputMode="numeric"
                min={1}
              />
              <FormError id={fields.dayRate.errorId} errors={fields.dayRate.errors} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.nightRate.id}>Nightly rate (11pm to 5am)</Label>
              <Input
                {...getInputProps(fields.nightRate, { type: "number" })}
                inputMode="numeric"
                min={1}
              />
              <FormError id={fields.nightRate.errorId} errors={fields.nightRate.errors} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.fullDayRate.id}>Full day rate (24 hours)</Label>
              <Input
                {...getInputProps(fields.fullDayRate, { type: "number" })}
                inputMode="numeric"
                min={1}
              />
              <FormError id={fields.fullDayRate.errorId} errors={fields.fullDayRate.errors} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={fields.airportPickupRate.id}>Airport pickup rate</Label>
              <Input
                {...getInputProps(fields.airportPickupRate, { type: "number" })}
                inputMode="numeric"
                min={1}
              />
              <FormError
                id={fields.airportPickupRate.errorId}
                errors={fields.airportPickupRate.errors}
              />
            </div>

            <label
              htmlFor={fields.pricingIncludesFuel.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 sm:col-span-2"
            >
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
              <span>
                <span className="block text-sm font-medium">Pricing includes fuel</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Customers will not be offered a separate fuel upgrade.
                </span>
              </span>
            </label>

            {pricingIncludesFuel.value === "on" ? (
              <input type="hidden" name={fields.fuelUpgradeRate.name} value="" />
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={fields.fuelUpgradeRate.id}>Fuel upgrade rate</Label>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Vehicle settings</h3>
            </CardTitle>
            <CardDescription>Update how this car is classified and listed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={fields.vehicleType.id}>Vehicle type</Label>
              <Select
                key={fields.vehicleType.key}
                name={fields.vehicleType.name}
                defaultValue={fields.vehicleType.initialValue ?? car.vehicleType}
              >
                <SelectTrigger
                  id={fields.vehicleType.id}
                  className="w-full"
                  {...errorAttributes(fields.vehicleType.errors, fields.vehicleType.errorId)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fleetCarVehicleTypeSchema.options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {getFleetCarVehicleTypeLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError id={fields.vehicleType.errorId} errors={fields.vehicleType.errors} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.serviceTier.id}>Service tier</Label>
              <Select
                key={fields.serviceTier.key}
                name={fields.serviceTier.name}
                defaultValue={fields.serviceTier.initialValue ?? car.serviceTier}
              >
                <SelectTrigger
                  id={fields.serviceTier.id}
                  className="w-full"
                  {...errorAttributes(fields.serviceTier.errors, fields.serviceTier.errorId)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fleetCarServiceTierSchema.options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {getFleetCarServiceTierLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormError id={fields.serviceTier.errorId} errors={fields.serviceTier.errors} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={fields.passengerCapacity.id}>Passenger capacity</Label>
              <Input
                {...getInputProps(fields.passengerCapacity, { type: "number" })}
                inputMode="numeric"
                min={1}
                max={15}
              />
              <FormError
                id={fields.passengerCapacity.errorId}
                errors={fields.passengerCapacity.errors}
              />
            </div>

            {car.status === "BOOKED" ? (
              <div className="space-y-2">
                <Label htmlFor="booked-car-availability">Availability</Label>
                <p
                  id="booked-car-availability"
                  className="flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground"
                >
                  Booked cars keep their current status.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={fields.status.id}>Availability</Label>
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
              </div>
            )}
          </CardContent>
        </Card>

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
