import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import type { BookingType } from "~/booking/types";
import { publicAddonsSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getPublicAddons({
  request,
  bookingType,
}: {
  readonly request: Request;
  readonly bookingType: BookingType;
}) {
  const search = new URLSearchParams({ bookingType });

  return getApiClient().request({
    path: `/api/addons?${search}`,
    request,
    schema: publicAddonsSchema,
  });
}
