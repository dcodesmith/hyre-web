import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  type FleetCar,
  fleetCarSchema,
  fleetCarsSchema,
  replaceFleetCarDocumentResponseSchema,
  replaceFleetCarImageResponseSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function getFleetCars({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/fleet-owner/cars",
    request,
    forwardCookie: true,
    schema: fleetCarsSchema,
  });
}

export function getFleetCar({
  request,
  carId,
}: {
  readonly request: Request;
  readonly carId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${encodeURIComponent(carId)}`,
    request,
    forwardCookie: true,
    schema: fleetCarSchema,
  });
}

export type UpdateFleetCarBody = Pick<
  FleetCar,
  | "airportPickupRate"
  | "dayRate"
  | "fullDayRate"
  | "fuelUpgradeRate"
  | "hourlyRate"
  | "nightRate"
  | "pricingIncludesFuel"
> & {
  readonly status?: "AVAILABLE" | "HOLD" | "IN_SERVICE";
};

export function updateFleetCar({
  request,
  carId,
  body,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly body: UpdateFleetCarBody;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${encodeURIComponent(carId)}`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: body,
    schema: fleetCarSchema,
  });
}

export function replaceFleetCarImage({
  request,
  carId,
  imageId,
  file,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly imageId: string;
  readonly file: File;
}) {
  const formData = new FormData();
  formData.set("file", file);

  return getApiClient().request({
    path: `/api/fleet-owner/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}/file`,
    method: "PUT",
    request,
    forwardCookie: true,
    formData,
    schema: replaceFleetCarImageResponseSchema,
  });
}

export function replaceFleetCarDocument({
  request,
  carId,
  documentId,
  file,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly documentId: string;
  readonly file: File;
}) {
  const formData = new FormData();
  formData.set("file", file);

  return getApiClient().request({
    path: `/api/fleet-owner/cars/${encodeURIComponent(carId)}/documents/${encodeURIComponent(documentId)}/file`,
    method: "PUT",
    request,
    forwardCookie: true,
    formData,
    schema: replaceFleetCarDocumentResponseSchema,
  });
}
