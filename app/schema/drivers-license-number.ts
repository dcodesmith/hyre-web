import { z } from "zod";

export const FRSC_DRIVERS_LICENSE_NUMBER = /^[A-Z]{2,3}\d{5}[A-Z]{2}\d{2}$/;
export const DRIVERS_LICENSE_NUMBER_INVALID = "Enter a valid driver's licence number";
export const DRIVERS_LICENSE_NUMBER_REQUIRED = "Driver's licence number is required";

export function normalizeDriversLicenseNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

export const driversLicenseNumberSchema = z
  .string({ error: DRIVERS_LICENSE_NUMBER_REQUIRED })
  .trim()
  .transform(normalizeDriversLicenseNumber)
  .refine((value) => value.length > 0, { message: DRIVERS_LICENSE_NUMBER_REQUIRED })
  .refine((value) => FRSC_DRIVERS_LICENSE_NUMBER.test(value), {
    message: DRIVERS_LICENSE_NUMBER_INVALID,
  });

export const optionalDriversLicenseNumberSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "" : normalizeDriversLicenseNumber(value)))
  .refine((value) => value === "" || FRSC_DRIVERS_LICENSE_NUMBER.test(value), {
    message: DRIVERS_LICENSE_NUMBER_INVALID,
  })
  .optional();
