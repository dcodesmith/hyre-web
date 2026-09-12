import { z } from "zod";

export const addonPricingUnitSchema = z.enum(["PER_BOOKING", "PER_LEG"]);

export const publicAddonSchema = z.object({
  id: z.string().cuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  pricingUnit: addonPricingUnitSchema,
  unitPrice: z.number().nonnegative(),
  currency: z.literal("NGN"),
});

export const publicAddonsSchema = z.object({
  addons: z.array(publicAddonSchema),
});

export type AddonPricingUnit = z.output<typeof addonPricingUnitSchema>;
export type PublicAddon = z.output<typeof publicAddonSchema>;
