import { env } from "cloudflare:workers";
import { createApiClient } from "~/api/api.server";
import {
  fleetBookingAssignmentSchema,
  fleetBookingDetailSchema,
  fleetBookingsSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getFleetBookings({
  request,
  searchParams,
}: {
  readonly request: Request;
  readonly searchParams: URLSearchParams;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/bookings?${searchParams}`,
    request,
    forwardCookie: true,
    schema: fleetBookingsSchema,
  });
}

export function getFleetBooking({
  request,
  bookingId,
}: {
  readonly request: Request;
  readonly bookingId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/bookings/${encodeURIComponent(bookingId)}`,
    request,
    forwardCookie: true,
    schema: fleetBookingDetailSchema,
  });
}

export function assignFleetBookingChauffeur({
  request,
  bookingId,
  chauffeurId,
}: {
  readonly request: Request;
  readonly bookingId: string;
  readonly chauffeurId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/bookings/${encodeURIComponent(bookingId)}/chauffeur`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: { chauffeurId },
    schema: fleetBookingAssignmentSchema,
  });
}
