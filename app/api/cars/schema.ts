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

const searchCarSchema = publicCarSchema.extend({
  color: z.string().nullable(),
  nightRate: z.number().nullable(),
  fullDayRate: z.number().nullable(),
  airportPickupRate: z.number().nullable(),
  owner: z.object({
    username: z.string().nullable(),
    name: z.string().nullable(),
  }),
});

const searchFiltersSchema = z.object({
  serviceTiers: z.array(z.enum(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"])),
  vehicleTypes: z.array(z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"])),
  bookingType: z.enum(["DAY", "NIGHT", "FULL_DAY", "AIRPORT_PICKUP"]).nullable(),
});

const searchFacetsSchema = z.object({
  makes: z.array(z.object({ name: z.string(), count: z.number().int() })),
  price: z.object({ min: z.number(), max: z.number() }),
});

const searchPaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const carSearchResponseSchema = z.object({
  cars: z.array(searchCarSchema),
  filters: searchFiltersSchema,
  facets: searchFacetsSchema.nullable(),
  pagination: searchPaginationSchema,
});

export const publicCarDetailSchema = searchCarSchema.extend({
  hourlyRate: z.number().nullable(),
  fuelUpgradeRate: z.number().nullable(),
});

export type PublicCar = z.infer<typeof publicCarSchema>;
export type SearchCar = z.infer<typeof searchCarSchema>;
export type PublicCarDetail = z.infer<typeof publicCarDetailSchema>;
export type CarCategory = z.infer<typeof categorySchema>;
export type CarCategoriesResponse = z.infer<typeof carCategoriesResponseSchema>;
export type CarSearchResponse = z.infer<typeof carSearchResponseSchema>;
export type SearchFacets = NonNullable<CarSearchResponse["facets"]>;
export type SearchPagination = CarSearchResponse["pagination"];
