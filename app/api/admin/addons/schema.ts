import { z } from "zod";
import { addonPricingUnitSchema } from "~/api/addons/schema";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

export const addonFinancialTreatmentSchema = z.enum(["PLATFORM", "FLEET_OWNER"]);

export const adminAddonPriceSchema = z.object({
  id: z.string().cuid(),
  addonId: z.string().cuid(),
  amount: z.number().positive(),
  effectiveSince: z.iso.datetime(),
  effectiveUntil: z.iso.datetime().nullable(),
  createdById: z.string(),
  updatedById: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const addonMutationSchema = z.object({
  id: z.string().cuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  bookingTypes: z.array(z.enum(BOOKING_TYPE_OPTIONS)),
  pricingUnit: addonPricingUnitSchema,
  financialTreatment: addonFinancialTreatmentSchema,
  isActive: z.boolean(),
  createdById: z.string(),
  updatedById: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const adminAddonSchema = addonMutationSchema.extend({
  prices: z.array(adminAddonPriceSchema),
});

export const adminAddonsSchema = z.object({
  addons: z.array(adminAddonSchema),
});

export type AddonFinancialTreatment = z.output<typeof addonFinancialTreatmentSchema>;
export type AdminAddon = z.output<typeof adminAddonSchema>;
