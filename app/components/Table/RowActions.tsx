import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { useFetcher, useNavigate } from "react-router";
import { Row } from "@tanstack/react-table";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { useToast } from "~/hooks/use-toast";
import { carUpdateSchema, STATUSES } from "~/schemas/car.schema";
import type { SerializedCar } from "~/types";
import { serviceTierLabels, ServiceTiers, vehicleTypeLabels, VehicleTypes } from "~/types";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

const statusMap: Record<(typeof STATUSES)[number], string> = {
  AVAILABLE: "Available",
  HOLD: "On Hold",
  IN_SERVICE: "In Service",
};

interface EditCarFormProps {
  readonly car: SerializedCar;
  readonly setIsEditOpen: Dispatch<SetStateAction<boolean>>;
}

function EditCarForm({ car, setIsEditOpen }: EditCarFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const csrfToken = useAuthenticityToken();

  useEffect(() => {
    if (fetcher.data && !fetcher.data?.success) {
      setIsEditOpen(true);
    }

    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsEditOpen(false);
    }
  }, [fetcher.data, setIsEditOpen, fetcher.state]);

  const [
    form,
    {
      make,
      model,
      year,
      registrationNumber,
      dayRate,
      status,
      hourlyRate,
      nightRate,
      fullDayRate,
      fuelUpgradeRate,
      airportPickupRate,
      pricingIncludesFuel,
      vehicleType,
      serviceTier,
      passengerCapacity,
    },
  ] = useForm({
    defaultValue: car,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carUpdateSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  const pricingIncludesFuelControl = useInputControl(pricingIncludesFuel);

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="csrf" value={csrfToken} />
      {fetcher.data?.error && <p className="text-sm text-red-500">{fetcher.data.error}</p>}
      <div className="space-y-0.5">
        <Label htmlFor={make.id}>Make</Label>
        <Input readOnly {...getInputProps(make, { type: "text" })} />
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={model.id}>Model</Label>
        <Input readOnly {...getInputProps(model, { type: "text" })} />
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={year.id}>Year</Label>
        <Input readOnly {...getInputProps(year, { type: "number" })} />
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={registrationNumber.id}>Registration Number</Label>
        <Input readOnly {...getInputProps(registrationNumber, { type: "text" })} />
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={dayRate.id}>Day Rate</Label>
        <Input
          {...getInputProps(dayRate, { type: "number" })}
          step="1000"
          className={
            dayRate.errors ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2" : ""
          }
        />
        {dayRate.errors && <p className="text-sm text-destructive">{dayRate.errors.join(" ")}</p>}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor="hourlyRate">Hourly Rate</Label>
        <Input
          {...getInputProps(hourlyRate, { type: "number" })}
          step="500"
          className={
            hourlyRate.errors
              ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              : ""
          }
        />
        {hourlyRate.errors && (
          <p className="text-sm text-destructive">{hourlyRate.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor="nightRate">Nightly Rate</Label>
        <Input
          {...getInputProps(nightRate, { type: "number" })}
          step="500"
          className={
            nightRate.errors ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2" : ""
          }
        />
        {nightRate.errors && (
          <p className="text-sm text-destructive">{nightRate.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor="fullDayRate">24-Hour Rate</Label>
        <Input
          {...getInputProps(fullDayRate, { type: "number" })}
          step="1000"
          className={
            fullDayRate.errors
              ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              : ""
          }
        />
        {fullDayRate.errors && (
          <p className="text-sm text-destructive">{fullDayRate.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label className="flex items-center space-x-2 cursor-pointer">
          <Checkbox
            id={pricingIncludesFuel.id}
            checked={
              pricingIncludesFuelControl.value === "on" ||
              pricingIncludesFuelControl.value === "true"
            }
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

      {pricingIncludesFuelControl.value !== "on" && pricingIncludesFuel.value !== "true" ? (
        <div className="space-y-0.5">
          <Label htmlFor="fuelUpgradeRate">Fuel Upgrade Rate</Label>
          <Input
            {...getInputProps(fuelUpgradeRate, { type: "number" })}
            step="1000"
            className={
              fuelUpgradeRate.errors
                ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                : ""
            }
            placeholder="Cost to upgrade from partial to full tank"
          />
          {fuelUpgradeRate.errors && (
            <p className="text-sm text-destructive">{fuelUpgradeRate.errors.join(" ")}</p>
          )}
          <p className="text-xs text-gray-500">
            Amount charged to customers who want to upgrade from partial tank to full tank for 1-2
            day bookings
          </p>
        </div>
      ) : (
        <input type="hidden" name={fuelUpgradeRate.name} value="" />
      )}

      <div className="space-y-0.5">
        <Label htmlFor="airportPickupRate">Airport Pickup Rate</Label>
        <Input
          {...getInputProps(airportPickupRate, { type: "number" })}
          step="1000"
          className={
            airportPickupRate.errors
              ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              : ""
          }
          placeholder="Rate for airport pickup service"
        />
        {airportPickupRate.errors && (
          <p className="text-sm text-destructive">{airportPickupRate.errors.join(" ")}</p>
        )}
        <p className="text-xs text-gray-500">
          Flat rate charged for airport pickup service (including flight tracking)
        </p>
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={vehicleType.id}>Vehicle Type</Label>
        <Select name={vehicleType.name} defaultValue={car.vehicleType}>
          <SelectTrigger
            className={
              vehicleType.errors
                ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                : ""
            }
          >
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
          <p className="text-sm text-destructive">{vehicleType.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={serviceTier.id}>Service Tier</Label>
        <Select name={serviceTier.name} defaultValue={car.serviceTier}>
          <SelectTrigger
            className={
              serviceTier.errors
                ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                : ""
            }
          >
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
          <p className="text-sm text-destructive">{serviceTier.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <Label htmlFor={passengerCapacity.id}>Passenger Capacity</Label>
        <Input
          {...getInputProps(passengerCapacity, { type: "number" })}
          min={1}
          max={15}
          className={
            passengerCapacity.errors
              ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              : ""
          }
        />
        {passengerCapacity.errors && (
          <p className="text-sm text-destructive">{passengerCapacity.errors.join(" ")}</p>
        )}
      </div>

      {car.status !== "BOOKED" && (
        <div className="space-y-0.5">
          <Label htmlFor={status.id}>Status</Label>
          <Select
            {...getInputProps(status, { type: "text" })}
            defaultValue={status.value ?? car.status}
          >
            <SelectTrigger>
              <SelectValue placeholder={statusMap[car.status]} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status} defaultValue={car.status}>
                  {statusMap[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="intent" value="edit" />

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </fetcher.Form>
  );
}

interface DataTableRowActionsProps {
  readonly row: Row<SerializedCar>;
}

export function RowActions({ row }: DataTableRowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { toast } = useToast();
  const csrfToken = useAuthenticityToken();

  const onDelete = () => {
    fetcher.submit(
      { id: row.original.id, csrf: csrfToken },
      {
        method: "DELETE",
        action: `/fleet-owner/cars/${row.original.id}?index`,
        preventScrollReset: true,
      },
    );

    toast({
      title: "Success",
      description: "Car deleted successfully",
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted rounded">
            <EllipsisHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.original.status !== "BOOKED" && (
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>Edit</DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => navigate(`/fleet-owner/cars/details/${row.original.id}`)}
          >
            Details
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-[400px] w-full px-8 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Car</SheetTitle>
            <SheetDescription>
              Make changes to your car here. Click save when you&apos;re done.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <EditCarForm car={row.original} setIsEditOpen={setIsEditOpen} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
