import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { useFetcher } from "@remix-run/react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const Status = {
  AVAILABLE: "AVAILABLE",
  BOOKED: "BOOKED",
  HOLD: "HOLD",
  IN_SERVICE: "IN_SERVICE",
} as const;

export const carSchema = z.object({
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
      required_error: "Price is required.",
    })
    .positive("Price must be positive"),

  status: z.nativeEnum(Status, {
    required_error: "Status is required.",
  }),

  hourlyRate: z
    .number({
      required_error: "Hourly rate is required.",
    })
    .int()
    .positive("Hourly rate must be positive"),

  nightRate: z
    .number({
      required_error: "Nightly rate is required.",
    })
    .int()
    .positive("Nightly rate must be positive"),

  fuelUpgradeRate: z
    .number({
      required_error: "Fuel upgrade rate is required.",
    })
    .int()
    .positive("Fuel upgrade rate must be positive"),

  // images: z.preprocess(
  //   (files) => {
  //     // If the input is a FileList, convert it to an array
  //     if (files instanceof FileList) return Array.from(files);
  //     return files;
  //   },
  //   z
  //     .array(z.instanceof(File, { message: "File is required" }))
  //     .min(1, "At least one file is required")
  //     .max(5, "You can upload up to 5 files")
  //     .refine(
  //       (files) => files.every((file) => file.size < 5 * 1024 * 1024),
  //       "Each file must be less than 5MB",
  //     )
  //     .refine(
  //       (files) =>
  //         files.every((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type)),
  //       "Files must be JPEG, PNG or WebP",
  //     ),
  // ),
  images: z
    .any()
    .array()
    .min(1, "At least one file is required")
    .max(5, "You can upload up to 5 files")
    .refine(
      (files) => Array.isArray(files) && files.every((file) => file && file.size > 0),
      "Pictures are required",
    )
    .refine(
      (files) => files.every((file) => file.size <= 5 * 1024 * 1024),
      "Each file must be less than 5MB",
    )
    .refine(
      (files) =>
        files.every((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type)),
      "Files must be JPEG, PNG or WebP",
    ),

  motCertificate: z
    .any()
    .refine((file) => file && file.size > 0, "MOT certificate is required")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine((file) => file.type === "application/pdf", "File must be a PDF"),

  insuranceCertificate: z
    .any()
    .refine((file) => file && file.size > 0, "Insurance certificate is required")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine((file) => file.type === "application/pdf", "File must be a PDF"),
});

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
      fuelUpgradeRate,
    },
  ] = useForm({
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
        <label className="text-sm">Status</label>

        <Select name="status">
          <SelectTrigger>
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
