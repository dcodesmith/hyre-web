import { z } from "zod";

export const chauffeurVerificationStatusSchema = z.enum([
  "INVITED",
  "CONSENTED",
  "PHONE_VERIFIED",
  "IDENTITY_VERIFIED",
  "APPROVED",
]);

export const chauffeurComplianceRequirementSchema = z.object({
  type: z.enum(["LASDRI", "LASRRA", "DRIVER_BADGE"]),
  label: z.string(),
  required: z.boolean(),
});

export const chauffeurOnboardingSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string(),
  fleetOwnerName: z.string().nullable(),
  status: chauffeurVerificationStatusSchema,
  steps: z.object({
    consent: z.boolean(),
    phone: z.boolean(),
    nin: z.boolean(),
    driving: z.boolean(),
  }),
  complianceRequirements: z.array(chauffeurComplianceRequirementSchema),
});

export const chauffeurInvitationExchangeSchema = z.object({
  sessionToken: z.string().min(1),
  sessionExpiresAt: z.iso.datetime(),
  onboarding: chauffeurOnboardingSchema,
});

export const chauffeurPhoneVerificationSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED"]),
  phoneNumber: z.string(),
});

export const fleetOwnerChauffeurSchema = z.object({
  id: z.string(),
  chauffeurId: z.string().nullable(),
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string(),
  status: chauffeurVerificationStatusSchema,
  isActive: z.boolean(),
  image: z.string().nullable(),
  invitedAt: z.iso.datetime(),
});

export const fleetOwnerChauffeursSchema = z.object({
  items: z.array(fleetOwnerChauffeurSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  complianceRequirements: z.array(chauffeurComplianceRequirementSchema),
});

export type ChauffeurOnboarding = z.output<typeof chauffeurOnboardingSchema>;
export type ChauffeurVerificationStatus = z.output<typeof chauffeurVerificationStatusSchema>;
export type FleetOwnerChauffeur = z.output<typeof fleetOwnerChauffeurSchema>;
