import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { bookingsByStatusSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export type GetBookingsByStatusOptions = {
  request: Request;
};

export function getBookingsByStatus(options: GetBookingsByStatusOptions) {
  return getApiClient().request({
    path: "/api/bookings",
    request: options.request,
    forwardCookie: true,
    schema: bookingsByStatusSchema,
  });
}
