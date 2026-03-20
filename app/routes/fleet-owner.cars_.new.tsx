import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { z } from "zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { useFetcher } from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { carSchema } from "~/schemas/car.schema";
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
import { serviceTierLabels, ServiceTiers, vehicleTypeLabels, VehicleTypes } from "~/types";

const Status = {
  AVAILABLE: "AVAILABLE",
  BOOKED: "BOOKED",
  HOLD: "HOLD",
  IN_SERVICE: "IN_SERVICE",
} as const;

const statusMap: Record<Exclude<(typeof Status)[keyof typeof Status], "BOOKED">, string> = {
  AVAILABLE: "Available",
  HOLD: "On Hold",
  IN_SERVICE: "In Service",
};

export function NewCarForm() {
  const fetcher = useFetcher<{ success: boolean; error?: string }>({
    key: "new-car",
  });
  const csrfToken = useAuthenticityToken();

  const lastResult = fetcher.data;

  const [
    form,
    {
      make,
      model,
      year,
      dayRate,
      status,
      images,
      hourlyRate,
      registrationNumber,
      motCertificate,
      insuranceCertificate,
      nightRate,
      fullDayRate,
      fuelUpgradeRate,
      airportPickupRate,
      pricingIncludesFuel,
      vehicleType,
      serviceTier,
      passengerCapacity,
    },
  ] = useForm<z.infer<typeof carSchema>>({
    defaultValue: {
      pricingIncludesFuel: false,
    },
    lastResult:
      fetcher.state === "idle" && lastResult?.success === false
        ? { status: "error" as const, error: {} }
        : null,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carSchema });
    },
    shouldValidate: "onInput",
  });

  const isSubmitting = fetcher.state === "submitting";
  const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  const pricingIncludesFuelControl = useInputControl(pricingIncludesFuel);

  return (
    <fetcher.Form
      method="post"
      {...getFormProps(form)}
      encType="multipart/form-data"
      className="space-y-4"
    >
      <input type="hidden" name="csrf" value={csrfToken} />
      {fetcher.data?.error && <p className="text-red-600 text-sm">{fetcher.data?.error}</p>}
      <div className="space-y-0.5">
        <Label htmlFor={make.id}>Make</Label>
        <Input
          {...getInputProps(make, { type: "text" })}
          className={`rounded ${make.errors ? errorRingClasses : ""}`}
        />
        {make.errors && <p className="text-red-500 text-sm">{make.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={model.id}>Model</Label>
        <Input
          {...getInputProps(model, { type: "text" })}
          className={`rounded ${model.errors ? errorRingClasses : ""}`}
        />
        {model.errors && <p className="text-red-500 text-sm">{model.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={registrationNumber.id}>Registration Number</Label>
        <Input
          {...getInputProps(registrationNumber, { type: "text" })}
          className={`rounded ${registrationNumber.errors ? errorRingClasses : ""}`}
        />
        {registrationNumber.errors && (
          <p className="text-red-500 text-sm">{registrationNumber.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={year.id}>Year</Label>
        <Input
          {...getInputProps(year, { type: "number" })}
          className={`rounded ${year.errors ? errorRingClasses : ""}`}
        />
        {year.errors && <p className="text-red-500 text-sm">{year.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label className="flex items-center space-x-2 cursor-pointer">
          <Checkbox
            id={pricingIncludesFuel.id}
            checked={pricingIncludesFuelControl.value === "on"}
            onCheckedChange={(checked) => {
              pricingIncludesFuelControl.change(checked ? "on" : "");
            }}
            onBlur={pricingIncludesFuelControl.blur}
          />
          <span className="text-sm font-medium">Pricing includes fuel</span>
        </Label>

        <p className="text-xs text-gray-500">
          If checked, customers won't see fuel upgrade options. Fuel costs are included in your base
          rates.
        </p>
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={dayRate.id}>Daily Rate</Label>
        <Input
          {...getInputProps(dayRate, { type: "number", step: "1000" })}
          className={`rounded ${dayRate.errors ? errorRingClasses : ""}`}
        />
        {dayRate.errors && <p className="text-red-500 text-sm">{dayRate.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={hourlyRate.id}>Hourly Rate</Label>
        <Input
          {...getInputProps(hourlyRate, { type: "number", step: "1000" })}
          className={`rounded ${hourlyRate.errors ? errorRingClasses : ""}`}
        />
        {hourlyRate.errors && <p className="text-red-500 text-sm">{hourlyRate.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={nightRate.id}>Nightly Rate</Label>
        <Input
          {...getInputProps(nightRate, { type: "number", step: "1000" })}
          className={`rounded ${nightRate.errors ? errorRingClasses : ""}`}
        />
        {nightRate.errors && <p className="text-red-500 text-sm">{nightRate.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={fullDayRate.id}>24-Hour Rate</Label>
        <Input
          {...getInputProps(fullDayRate, { type: "number", step: "1000" })}
          className={`rounded ${fullDayRate.errors ? errorRingClasses : ""}`}
        />
        {fullDayRate.errors && (
          <p className="text-red-500 text-sm">{fullDayRate.errors.join(" ")}</p>
        )}
      </div>

      {pricingIncludesFuelControl.value !== "on" ? (
        <div className="space-y-0.5">
          <Label htmlFor={fuelUpgradeRate.id}>Fuel Upgrade Rate</Label>
          <Input
            {...getInputProps(fuelUpgradeRate, { type: "number", step: "1000" })}
            min={1000}
            className={`rounded ${fuelUpgradeRate.errors ? errorRingClasses : ""}`}
            placeholder="Cost to upgrade from partial to full tank"
          />
          {fuelUpgradeRate.errors && (
            <p className="text-red-500 text-sm">{fuelUpgradeRate.errors.join(" ")}</p>
          )}
          <p className="text-xs text-gray-500">
            Amount charged to customers who want to upgrade from partial tank (1/3 or 2/3) to full
            tank for 1-2 day bookings
          </p>
        </div>
      ) : (
        <input type="hidden" name={fuelUpgradeRate.name} value="" />
      )}

      <div className="space-y-0.5">
        <Label htmlFor={airportPickupRate.id}>Airport Pickup Rate</Label>
        <Input
          {...getInputProps(airportPickupRate, { type: "number", step: "1000" })}
          className={`rounded ${airportPickupRate.errors ? errorRingClasses : ""}`}
          placeholder="Rate for airport pickup service"
        />
        {airportPickupRate.errors && (
          <p className="text-red-500 text-sm">{airportPickupRate.errors.join(" ")}</p>
        )}
        <p className="text-xs text-gray-500">
          Flat rate charged for airport pickup service (including flight tracking)
        </p>
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={motCertificate.id}>MOT Certificate (PDF)</Label>
        <Input
          type="file"
          id={motCertificate.id}
          name={motCertificate.name}
          accept=".pdf"
          className={`rounded ${motCertificate.errors ? errorRingClasses : ""}`}
        />
        {motCertificate.errors && (
          <p className="text-red-500 text-sm">{motCertificate.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={insuranceCertificate.id}>Insurance Certificate (PDF)</Label>
        <Input
          type="file"
          id={insuranceCertificate.id}
          name={insuranceCertificate.name}
          accept=".pdf"
          className={`rounded ${insuranceCertificate.errors ? errorRingClasses : ""}`}
        />
        {insuranceCertificate.errors && (
          <p className="text-red-500 text-sm">{insuranceCertificate.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={images.id}>Pictures</Label>
        <Input
          {...getInputProps(images, { type: "file" })}
          multiple
          id={images.id}
          accept="image/*"
          className={`rounded ${images.errors ? errorRingClasses : ""}`}
        />
        {images.errors && <p className="text-red-500 text-sm">{images.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={vehicleType.id}>Vehicle Type</Label>
        <Select name={vehicleType.name} defaultValue={vehicleType.value}>
          <SelectTrigger className={vehicleType.errors ? errorRingClasses : ""}>
            <SelectValue placeholder="Select vehicle type" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(VehicleTypes).map((value) => (
              <SelectItem key={value} value={value}>
                {vehicleTypeLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vehicleType.errors && (
          <p className="text-red-500 text-sm">{vehicleType.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={serviceTier.id}>Service Tier</Label>
        <Select name={serviceTier.name} defaultValue={serviceTier.value}>
          <SelectTrigger className={serviceTier.errors ? errorRingClasses : ""}>
            <SelectValue placeholder="Select service tier" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ServiceTiers).map((value) => (
              <SelectItem key={value} value={value}>
                {serviceTierLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {serviceTier.errors && (
          <p className="text-red-500 text-sm">{serviceTier.errors.join(" ")}</p>
        )}
        <p className="text-xs text-gray-500">
          Standard: ₦30-50k/day • Executive: ₦60-100k/day • Luxury: ₦150-300k/day
        </p>
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={passengerCapacity.id}>Passenger Capacity</Label>
        <Input
          {...getInputProps(passengerCapacity, { type: "number" })}
          min={1}
          max={15}
          className={`rounded ${passengerCapacity.errors ? errorRingClasses : ""}`}
        />
        {passengerCapacity.errors && (
          <p className="text-red-500 text-sm">{passengerCapacity.errors.join(" ")}</p>
        )}
        <p className="text-xs text-gray-500">Number of passengers (excluding driver)</p>
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={status.id} className="text-sm">
          Status
        </Label>

        <Select name={status.name} defaultValue={status.value}>
          <SelectTrigger className={status.errors ? errorRingClasses : ""}>
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Status)
              .filter((status) => status !== Status.BOOKED)
              .map((status) => (
                <SelectItem key={status} value={status}>
                  {statusMap[status]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {status.errors && <p className="text-red-500 text-sm">{status.errors.join(" ")}</p>}
      </div>

      <input type="hidden" name="intent" value="create" />

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <CogIcon className="h-5 w-5 animate-spin" /> : "Add Car"}
      </Button>
    </fetcher.Form>
  );
}
