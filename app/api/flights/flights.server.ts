import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import { searchFlightResponseSchema, tripDurationResponseSchema } from "./schema";

const flightNumberSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{2,3}\d{1,5}$/i)
  .transform((value) => value.toUpperCase());
const flightDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);
const destinationSchema = z.string().trim().min(1).max(256);
let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function searchAirportPickupFlight(options: {
  request?: Request;
  flightNumber: string;
  date: string;
}) {
  const search = new URLSearchParams({
    flightNumber: flightNumberSchema.parse(options.flightNumber),
    date: flightDateSchema.parse(options.date),
  });

  return getApiClient().request({
    path: `/api/search-flight?${search}`,
    request: options.request,
    schema: searchFlightResponseSchema,
  });
}

export function calculateAirportTripDuration(options: { request?: Request; destination: string }) {
  const search = new URLSearchParams({
    destination: destinationSchema.parse(options.destination),
  });

  return getApiClient().request({
    path: `/api/calculate-trip-duration?${search}`,
    request: options.request,
    schema: tripDurationResponseSchema,
  });
}
