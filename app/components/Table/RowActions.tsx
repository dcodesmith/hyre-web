import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Car } from "@prisma/client";
import { useFetcher, useNavigate } from "@remix-run/react";
import { Row } from "@tanstack/react-table";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { useToast } from "~/hooks/use-toast";
import { Button } from "../ui/button";
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

const STATUSES = ["AVAILABLE", "HOLD", "IN_SERVICE"] as const;

const carSchema = z.object({
  make: z
    .string({
      required_error: "Make is required.",
    })
    .min(1),
  model: z
    .string({
      required_error: "Model is required.",
    })
    .min(1),
  year: z
    .number({
      required_error: "Year is required.",
    })
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  registrationNumber: z
    .string({
      required_error: "Registration number is required.",
    })
    .min(1)
    .transform((val) => val.toUpperCase())
    .pipe(
      z.string().refine(
        (val) => {
          const plate = val.replace(/\s+/g, "");
          const stateFormat = /^[A-Z]{3}[-]?\d{3}[A-Z]{2}$/;
          const federalFormat = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
          return stateFormat.test(plate) || federalFormat.test(plate);
        },
        {
          message:
            "Invalid Nigerian number plate format. Use formats like 'ABC-123XX', 'ABC123XX', or 'XX123XX'",
        },
      ),
    ),
  dayRate: z
    .number({
      required_error: "Day rate is required.",
    })
    .positive("Day rate must be positive"),
  status: z.enum(STATUSES),

  hourlyRate: z
    .number({
      required_error: "Hourly rate is required.",
    })
    .positive("Hourly rate must be positive"),

  nightRate: z
    .number({
      required_error: "Nightly rate is required.",
    })
    .positive("Nightly rate must be positive"),

  fullDayRate: z
    .number({
      required_error: "24-hour rate is required.",
    })
    .int()
    .positive("24-hour rate must be positive"),
  fuelUpgradeRate: z
    .number({
      required_error: "Fuel upgrade rate is required.",
    })
    .int()
    .positive("Fuel upgrade rate must be positive"),
});

const statusMap: Record<(typeof STATUSES)[number], string> = {
  AVAILABLE: "Available",
  HOLD: "On Hold",
  IN_SERVICE: "In Service",
};

interface EditCarFormProps {
  readonly car: Car & { fuelUpgradeRate: number };
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
    },
  ] = useForm({
    defaultValue: car,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

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
          Amount charged to customers who want to upgrade from partial tank to full tank for 1-2 day
          bookings
        </p>
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
  readonly row: Row<Car & { fuelUpgradeRate: number }>;
}

export function RowActions({ row }: DataTableRowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { toast } = useToast();

  const onDelete = () => {
    fetcher.submit(
      { id: row.original.id },
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
