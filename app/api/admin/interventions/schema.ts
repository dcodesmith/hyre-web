import { z } from "zod";

export const interventionKindSchema = z.enum([
  "CHAUFFEUR_DRIVERS_LICENSE",
  "OWNER_DRIVER_LICENSE",
  "CHAUFFEUR_FACE",
  "OWNER_DRIVER_FACE",
]);

export const verificationInterventionSchema = z.object({
  id: z.uuid(),
  kind: interventionKindSchema,
  status: z.enum(["OPEN", "AUTO_RESOLVED", "APPROVED", "REJECTED"]),
  applicantName: z.string(),
  licenseLast4: z.string().nullable(),
  hasSelfie: z.boolean(),
  hasNinPortrait: z.boolean(),
  document: z
    .object({
      id: z.uuid(),
      userId: z.uuid().nullable(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
});

export const verificationInterventionsSchema = z.object({
  items: z.array(verificationInterventionSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const interventionMutationSchema = z.object({ success: z.literal(true) });
export const interventionLicenseNumberSchema = z.object({ licenseNumber: z.string().min(1) });

export type VerificationIntervention = z.output<typeof verificationInterventionSchema>;
