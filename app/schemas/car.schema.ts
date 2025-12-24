import { z } from "zod";
import { SERVICE_TIERS, VEHICLE_TYPES } from "~/types";

const Status = {
  AVAILABLE: "AVAILABLE",
  BOOKED: "BOOKED",
  HOLD: "HOLD",
  IN_SERVICE: "IN_SERVICE",
} as const;

export const STATUSES = ["AVAILABLE", "HOLD", "IN_SERVICE"] as const;

// Shared field definitions
const makeField = z
  .string({
    error: "Make is required and must be a string.",
  })
  .min(1, "Make cannot be empty");

const modelField = z
  .string({
    error: "Model is required and must be a string.",
  })
  .min(1, "Model cannot be empty");

const registrationNumberField = z
  .string({
    error: "Registration number is required and must be a string.",
  })
  .min(1, "Registration number cannot be empty")
  .transform((val) => val.toUpperCase())
  .pipe(
    z.string().refine(
      (val) => {
        const plate = val.replaceAll(/\s+/g, "");
        const stateFormat = /^[A-Z]{3}[-]?\d{3}[A-Z]{2}$/;
        const federalFormat = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

        return stateFormat.test(plate) || federalFormat.test(plate);
      },
      {
        error:
          "Invalid Nigerian number plate format. Use formats like 'ABC-123XX', 'ABC123XX', or 'XX123XX'",
      },
    ),
  );

const dayRateField = z
  .number({
    error: "Day rate is required and must be a number.",
  })
  .positive("Day rate must be positive");

const fullDayRateField = z
  .int({
    error: "24-hour rate must be an integer.",
  })
  .positive("24-hour rate must be positive");

const fuelUpgradeRateField = z
  .int({
    error: "Fuel upgrade rate must be an integer.",
  })
  .positive("Fuel upgrade rate must be positive");

const hourlyRateField = z
  .int({
    error: "Hourly rate must be an integer.",
  })
  .positive("Hourly rate must be positive");

const nightRateField = z
  .int({
    error: "Nightly rate must be an integer.",
  })
  .positive("Nightly rate must be positive");

const airportPickupRateField = z
  .int({
    error: "Airport pickup rate must be an integer.",
  })
  .positive("Airport pickup rate must be positive");

const yearField = z
  .int({
    error: "Year must be an integer.",
  })
  .min(2015, "Year must be 2015 or later")
  .max(new Date().getFullYear() + 1, "Year cannot be in the future");

const statusField = z.enum(STATUSES, {
  error: "Status is required and must be valid.",
});

// Vehicle categorization fields
const vehicleTypeField = z.enum(VEHICLE_TYPES, {
  error: "Vehicle type is required.",
});

const serviceTierField = z.enum(SERVICE_TIERS, {
  error: "Service tier is required.",
});

const passengerCapacityField = z
  .int({
    error: "Passenger capacity must be an integer.",
  })
  .min(1, "Passenger capacity must be at least 1")
  .max(15, "Passenger capacity cannot exceed 15");

const carBaseSchema = z.object({
  make: makeField,
  model: modelField,
  year: yearField,
  registrationNumber: registrationNumberField,
  dayRate: dayRateField,
  status: statusField,
  hourlyRate: hourlyRateField,
  nightRate: nightRateField,
  fullDayRate: fullDayRateField,
  fuelUpgradeRate: fuelUpgradeRateField,
  airportPickupRate: airportPickupRateField,
  vehicleType: vehicleTypeField,
  serviceTier: serviceTierField,
  passengerCapacity: passengerCapacityField,
});

export const carSchema = carBaseSchema.extend({
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
      (files) => files.every((file) => file && file.size <= 5 * 1024 * 1024),
      "Each file must be less than 5MB",
    )
    .refine(
      (files) =>
        files.every(
          (file) => file && ["image/jpeg", "image/png", "image/webp"].includes(file.type),
        ),
      "Files must be JPEG, PNG or WebP",
    ),

  motCertificate: z
    .any()
    .refine((file) => file && file.size > 0, "MOT certificate is required")
    .refine((file) => file && file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine((file) => file?.type === "application/pdf", "File must be a PDF"),

  insuranceCertificate: z
    .any()
    .refine((file) => file && file.size > 0, "Insurance certificate is required")
    .refine((file) => file && file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine((file) => file?.type === "application/pdf", "File must be a PDF"),
});

export const carUpdateSchema = carBaseSchema.extend({
  carId: z.string().min(1, "Car ID cannot be empty"),
});
