import { CircleDollarSignIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { getFleetCarServiceTierLabel, getFleetCarVehicleTypeLabel } from "./fleet-car";

const rateFields = [
  ["hourlyRate", "Hourly rate"],
  ["dayRate", "Daily rate (12 hours)"],
  ["nightRate", "Nightly rate (11pm to 5am)"],
  ["fullDayRate", "Full day rate (24 hours)"],
  ["airportPickupRate", "Airport pickup rate"],
] as const;

export function CarPricingStep({ car }: { readonly car: FleetCar }) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "save-pricing";
  const [includesFuel, setIncludesFuel] = useState(car.pricingIncludesFuel);

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
        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="save-pricing" />
          <div className="grid gap-4 sm:grid-cols-2">
            {rateFields.map(([name, label]) => (
              <Field key={name}>
                <FieldLabel htmlFor={`onboarding-${name}`}>{label}</FieldLabel>
                <Input
                  id={`onboarding-${name}`}
                  name={name}
                  type="number"
                  className="h-10 rounded-sm"
                  inputMode="numeric"
                  autoComplete="off"
                  min={1}
                  defaultValue={car[name] ?? ""}
                  required
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="onboarding-vehicle-type">Vehicle type</FieldLabel>
              <select
                id="onboarding-vehicle-type"
                name="vehicleType"
                defaultValue={car.vehicleType}
                className="h-10 w-full min-w-0 rounded-sm border bg-background px-3 text-foreground text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {(["SEDAN", "SUV", "VAN", "CROSSOVER"] as const).map((value) => (
                  <option key={value} value={value}>
                    {getFleetCarVehicleTypeLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-service-tier">Service tier</FieldLabel>
              <select
                id="onboarding-service-tier"
                name="serviceTier"
                defaultValue={car.serviceTier}
                className="h-10 w-full min-w-0 rounded-sm border bg-background px-3 text-foreground text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"] as const).map((value) => (
                  <option key={value} value={value}>
                    {getFleetCarServiceTierLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 self-center text-sm font-medium">
              <input
                type="checkbox"
                name="pricingIncludesFuel"
                checked={includesFuel}
                onChange={(event) => setIncludesFuel(event.target.checked)}
                className="size-4"
              />
              <span>Pricing includes fuel</span>
            </label>
            {includesFuel ? null : (
              <Field>
                <FieldLabel htmlFor="onboarding-fuel-rate">Fuel upgrade rate</FieldLabel>
                <Input
                  id="onboarding-fuel-rate"
                  name="fuelUpgradeRate"
                  type="number"
                  className="h-10 rounded-sm"
                  inputMode="numeric"
                  autoComplete="off"
                  min={1}
                  defaultValue={car.fuelUpgradeRate ?? ""}
                  required
                />
                <FieldDescription>Required when the base prices exclude fuel.</FieldDescription>
              </Field>
            )}
          </div>
          {includesFuel ? <input type="hidden" name="fuelUpgradeRate" value="" /> : null}

          <Button type="submit" disabled={pending} aria-live="polite">
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Saving Pricing…" : "Save Pricing"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
