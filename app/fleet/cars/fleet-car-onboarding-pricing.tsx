import {
  type FieldMetadata,
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CircleDollarSignIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  carOnboardingPricingFormSchema,
  type FleetCarOnboardingActionData,
} from "./car-onboarding-form-schema";
import { getFleetCarServiceTierLabel, getFleetCarVehicleTypeLabel } from "./fleet-car";

const selectClassName =
  "h-10 w-full min-w-0 rounded-sm border bg-background px-3 text-foreground text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const rateFields = [
  ["hourlyRate", "Hourly rate"],
  ["dayRate", "Daily rate (12 hours)"],
  ["nightRate", "Nightly rate (11pm to 5am)"],
  ["fullDayRate", "Full day rate (24 hours)"],
  ["airportPickupRate", "Airport pickup rate"],
] as const;

type Props = {
  readonly actionData?: FleetCarOnboardingActionData;
  readonly car: FleetCar;
};

function RateField({ field, label }: { readonly field: FieldMetadata; readonly label: string }) {
  return (
    <Field data-invalid={Boolean(field.errors)}>
      <FieldLabel htmlFor={field.id}>{label}</FieldLabel>
      <Input
        {...getInputProps(field, { type: "number" })}
        className="h-10 rounded-sm"
        inputMode="numeric"
        autoComplete="off"
        min={1}
        aria-invalid={field.errors ? true : undefined}
      />
      <FieldError id={field.errorId} errors={field.errors} />
    </Field>
  );
}

function EnumSelectField({
  field,
  label,
  options,
}: {
  readonly field: FieldMetadata;
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}) {
  return (
    <Field data-invalid={Boolean(field.errors)}>
      <FieldLabel htmlFor={field.id}>{label}</FieldLabel>
      <select {...getSelectProps(field)} className={selectClassName}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={field.errorId} errors={field.errors} />
    </Field>
  );
}

export function CarPricingStep({ actionData, car }: Props) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "save-pricing";
  const [form, fields] = useForm({
    id: "fleet-car-onboarding-pricing",
    lastResult: actionData?.intent === "save-pricing" ? actionData.submission : null,
    constraint: getZodConstraint(carOnboardingPricingFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      hourlyRate: car.hourlyRate == null ? "" : String(car.hourlyRate),
      dayRate: car.dayRate == null ? "" : String(car.dayRate),
      nightRate: car.nightRate == null ? "" : String(car.nightRate),
      fullDayRate: car.fullDayRate == null ? "" : String(car.fullDayRate),
      airportPickupRate: car.airportPickupRate == null ? "" : String(car.airportPickupRate),
      fuelUpgradeRate: car.fuelUpgradeRate == null ? "" : String(car.fuelUpgradeRate),
      pricingIncludesFuel: car.pricingIncludesFuel ? "on" : "",
      vehicleType: car.vehicleType,
      serviceTier: car.serviceTier,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carOnboardingPricingFormSchema });
    },
  });
  const [includesFuel, setIncludesFuel] = useState(
    actionData?.intent === "save-pricing"
      ? actionData.submission?.initialValue?.pricingIncludesFuel === "on"
      : car.pricingIncludesFuel,
  );

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CircleDollarSignIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>
            <h3>Pricing</h3>
          </CardTitle>
        </div>
        <CardDescription>Set the base rates customers will see for this car.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" {...getFormProps(form)} className="space-y-5">
          <input type="hidden" name="intent" value="save-pricing" />
          <div className="grid gap-4 sm:grid-cols-2">
            {rateFields.map(([name, label]) => (
              <RateField key={name} field={fields[name]} label={label} />
            ))}
            <EnumSelectField
              field={fields.vehicleType}
              label="Vehicle type"
              options={(["SEDAN", "SUV", "VAN", "CROSSOVER"] as const).map((value) => ({
                value,
                label: getFleetCarVehicleTypeLabel(value),
              }))}
            />
            <EnumSelectField
              field={fields.serviceTier}
              label="Service tier"
              options={(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"] as const).map(
                (value) => ({
                  value,
                  label: getFleetCarServiceTierLabel(value),
                }),
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 self-center text-sm font-medium">
              <input
                type="checkbox"
                name={fields.pricingIncludesFuel.name}
                checked={includesFuel}
                onChange={(event) => setIncludesFuel(event.target.checked)}
                className="size-4"
              />
              <span>Pricing includes fuel</span>
            </label>
            {includesFuel ? null : (
              <Field data-invalid={Boolean(fields.fuelUpgradeRate.errors)}>
                <FieldLabel htmlFor={fields.fuelUpgradeRate.id}>Fuel upgrade rate</FieldLabel>
                <Input
                  {...getInputProps(fields.fuelUpgradeRate, { type: "number" })}
                  className="h-10 rounded-sm"
                  inputMode="numeric"
                  autoComplete="off"
                  min={1}
                  aria-invalid={fields.fuelUpgradeRate.errors ? true : undefined}
                />
                <FieldDescription>Required when the base prices exclude fuel.</FieldDescription>
                <FieldError
                  id={fields.fuelUpgradeRate.errorId}
                  errors={fields.fuelUpgradeRate.errors}
                />
              </Field>
            )}
          </div>
          {includesFuel ? (
            <input type="hidden" name={fields.fuelUpgradeRate.name} value="" />
          ) : null}
          <FormError id={form.errorId} errors={form.errors} />

          <Button type="submit" disabled={pending} aria-live="polite">
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Saving Pricing…" : "Save Pricing"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
