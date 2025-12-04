import { z } from "zod";

const chauffeurBaseSchema = z.object({
  email: z.email("Invalid email address"),
  name: z.string().min(1, "Name cannot be empty"),
  phoneNumber: z
    .string()
    .regex(
      /^\+234[789][01]\d{8}$/,
      "Phone number must be a valid Nigerian number (e.g., +2349012341234)",
    ),
  address: z.string().min(1, "Address cannot be empty"),
});

export const chauffeurSchema = chauffeurBaseSchema.extend({
  ninFile: z
    .any()
    .refine((file) => file && file.size > 0, "Please select a file")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) => ["image/jpeg", "image/png"].includes(file.type),
      "File must be a JPEG or PNG",
    ),
  drivingLicenceFile: z
    .any()
    .refine((file) => file && file.size > 0, "Please select a file")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) => ["image/jpeg", "image/png"].includes(file.type),
      "File must be a JPEG or PNG",
    ),
});

export const chauffeurUpdateSchema = chauffeurBaseSchema.extend({
  chauffeurId: z.string().min(1, "Chauffeur ID cannot be empty"),
});
