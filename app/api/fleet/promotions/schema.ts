import { z } from "zod";

const promotionDiscountSchema = z
  .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().min(1).max(50));

const fleetOwnerPromotionBaseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  carId: z.string().nullable(),
  name: z.string().nullable(),
  discountValue: promotionDiscountSchema,
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const fleetOwnerPromotionSchema = fleetOwnerPromotionBaseSchema.extend({
  car: z
    .object({
      id: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      registrationNumber: z.string(),
    })
    .nullable(),
});

export const fleetOwnerPromotionsSchema = z.array(fleetOwnerPromotionSchema);
export const fleetOwnerPromotionMutationSchema = fleetOwnerPromotionBaseSchema;

export type FleetOwnerPromotion = z.output<typeof fleetOwnerPromotionSchema>;
