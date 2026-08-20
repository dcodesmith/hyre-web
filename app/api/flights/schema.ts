import { z } from "zod";

const flightSchema = z.object({
  flightNumber: z.string(),
  flightId: z.string(),
  origin: z.string(),
  originIATA: z.string().optional(),
  originName: z.string().optional(),
  destination: z.string(),
  destinationIATA: z.string().optional(),
  destinationName: z.string().optional(),
  destinationCity: z.string().optional(),
  scheduledArrival: z.string(),
  scheduledDeparture: z.string(),
  estimatedArrival: z.string().optional(),
  actualArrival: z.string().optional(),
  arrivalTime: z.string(),
  arrivalTimeSource: z.enum(["actual", "estimated", "scheduled"]),
  status: z.string().optional(),
  warning: z.string().optional(),
});

export const searchFlightResponseSchema = z.object({
  flight: flightSchema,
  warning: z.string().optional(),
});

export const tripDurationResponseSchema = z.object({
  durationMinutes: z.number(),
  distanceMeters: z.number(),
  isEstimate: z.boolean(),
});

export type SearchFlight = z.infer<typeof flightSchema>;
export type SearchFlightResponse = z.infer<typeof searchFlightResponseSchema>;
export type TripDurationResponse = z.infer<typeof tripDurationResponseSchema>;
