import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Status } from "@prisma/client";
import { useFetcher, useNavigate } from "@remix-run/react";
import { Row } from "@tanstack/react-table";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { z } from "zod";
import { useToast } from "~/hooks/use-toast";
import { SerializedCar } from "~/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

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
        }
      )
    ),
  price: z
    .number({
      required_error: "Price is required.",
    })
    .positive("Price must be positive"),
  status: z.nativeEnum(Status),
});

const STATUSES = Object.values(Status).filter(
  (status) => status !== Status.BOOKED
);

const statusMap: Record<Exclude<Status, "BOOKED">, string> = {
  AVAILABLE: "Available",
  HOLD: "On Hold",
  IN_SERVICE: "In Service",
};

interface EditCarFormProps {
  car: SerializedCar;
  setIsEditOpen: Dispatch<SetStateAction<boolean>>;
}

function EditCarForm({ car, setIsEditOpen }: EditCarFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data && !fetcher.data?.success) {
      setIsEditOpen(true);
    }

    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsEditOpen(false);
    }
  }, [fetcher.data, setIsEditOpen, fetcher.state]);

  const [form, { make, model, year, registrationNumber, price, status }] =
    useForm({
      defaultValue: car,
      onValidate({ formData }) {
        return parseWithZod(formData, { schema: carSchema });
      },
      shouldValidate: "onInput",
      shouldRevalidate: "onInput",
    });

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="space-y-4">
      {fetcher.data?.error && (
        <p className="text-sm text-red-500">{fetcher.data.error}</p>
      )}
      <div className="space-y-1">
        <Label htmlFor={make.id}>Make</Label>
        <Input readOnly {...getInputProps(make, { type: "text" })} />
      </div>

      <div className="space-y-1">
        <Label htmlFor={model.id}>Model</Label>
        <Input readOnly {...getInputProps(model, { type: "text" })} />
      </div>

      <div className="space-y-1">
        <Label htmlFor={year.id}>Year</Label>
        <Input readOnly {...getInputProps(year, { type: "number" })} />
      </div>

      <div className="space-y-1">
        <Label htmlFor={registrationNumber.id}>Registration Number</Label>
        <Input
          readOnly
          {...getInputProps(registrationNumber, { type: "text" })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={price.id}>Price</Label>
        <Input
          {...getInputProps(price, { type: "number" })}
          step="1000"
          className={
            price.errors
              ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              : ""
          }
        />
        {price.errors && (
          <p className="text-sm text-destructive">{price.errors.join(" ")}</p>
        )}
      </div>

      {car.status !== Status.BOOKED && (
        <div className="space-y-1">
          <Label htmlFor={status.id}>Status</Label>
          <Select name="status">
            <SelectTrigger>
              <SelectValue placeholder={statusMap[car.status]} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
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
  row: Row<SerializedCar>;
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
      }
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
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted rounded"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.original.status !== Status.BOOKED && (
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              Edit
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() =>
              navigate(`/fleet-owner/cars/details/${row.original.id}`)
            }
          >
            Details
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-[400px] px-8">
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
