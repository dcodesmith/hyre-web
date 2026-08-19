import { z } from "zod";

const promotionSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  discountValue: z.number(),
});

const publicCarSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  dayRate: z.number(),
  passengerCapacity: z.number().int(),
  pricingIncludesFuel: z.boolean(),
  vehicleType: z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"]),
  serviceTier: z.enum(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"]),
  images: z.array(z.object({ url: z.string() })),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  promotion: promotionSchema.nullable(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
});

const categorySchema = z.object({
  name: z.enum(["suv", "luxury", "budget", "sedan", "executive", "popular"]),
  title: z.string(),
  type: z.enum(["serviceTier", "vehicleType", "make"]),
  cars: z.array(publicCarSchema),
});

export const carCategoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
  allCars: z.array(publicCarSchema),
  total: z.number().int(),
});

export type PublicCar = z.infer<typeof publicCarSchema>;
export type CarCategory = z.infer<typeof categorySchema>;
export type CarCategoriesResponse = z.infer<typeof carCategoriesResponseSchema>;
