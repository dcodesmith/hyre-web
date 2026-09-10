import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  fleetCarSubmissionSchema,
  fleetInsuranceVerificationSchema,
  fleetVehicleVerificationSchema,
} from "./onboarding-schema";
import { fleetCarSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

export function createFleetVehicleVerification({
  request,
  idempotencyKey,
  body,
}: {
  readonly request: Request;
  readonly idempotencyKey: string;
  readonly body: { readonly plateNumber: string; readonly policyNumber: string };
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/vehicle-verifications",
    method: "POST",
    request,
    forwardCookie: true,
    headers: { "Idempotency-Key": idempotencyKey },
    json: body,
    schema: fleetVehicleVerificationSchema,
  });
}

export function getFleetVehicleVerification({
  request,
  verificationId,
}: {
  readonly request: Request;
  readonly verificationId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/vehicle-verifications/${pathSegment(verificationId)}`,
    request,
    forwardCookie: true,
    schema: fleetVehicleVerificationSchema,
  });
}

export function createFleetDraftCar({
  request,
  verificationId,
}: {
  readonly request: Request;
  readonly verificationId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/vehicle-verifications/${pathSegment(verificationId)}/car`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: fleetCarSchema,
  });
}

export function uploadFleetDraftCarDocuments({
  request,
  carId,
  motCertificate,
  insuranceCertificate,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly motCertificate: File;
  readonly insuranceCertificate: File;
}) {
  const formData = new FormData();
  formData.set("motCertificate", motCertificate);
  formData.set("insuranceCertificate", insuranceCertificate);
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${pathSegment(carId)}/documents`,
    method: "POST",
    request,
    forwardCookie: true,
    formData,
    schema: fleetCarSchema,
  });
}

export function uploadFleetDraftCarImages({
  request,
  carId,
  images,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly images: File[];
}) {
  const formData = new FormData();
  for (const image of images) formData.append("images", image);
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${pathSegment(carId)}/images`,
    method: "POST",
    request,
    forwardCookie: true,
    formData,
    schema: fleetCarSchema,
  });
}

export type FleetCarPricingInput = {
  readonly hourlyRate: number;
  readonly dayRate: number;
  readonly nightRate: number;
  readonly fullDayRate: number;
  readonly airportPickupRate: number;
  readonly fuelUpgradeRate: number | null;
  readonly pricingIncludesFuel: boolean;
  readonly vehicleType: "SEDAN" | "SUV" | "VAN" | "CROSSOVER";
  readonly serviceTier: "STANDARD" | "EXECUTIVE" | "LUXURY" | "ULTRA_LUXURY";
};

export function updateFleetDraftCarPricing({
  request,
  carId,
  body,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly body: FleetCarPricingInput;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${pathSegment(carId)}/pricing`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: body,
    schema: fleetCarSchema,
  });
}

export function createFleetInsuranceVerification({
  request,
  carId,
  idempotencyKey,
  body,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly idempotencyKey: string;
  readonly body: { readonly policyNumber: string };
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${pathSegment(carId)}/insurance-verifications`,
    method: "POST",
    request,
    forwardCookie: true,
    headers: { "Idempotency-Key": idempotencyKey },
    json: body,
    schema: fleetInsuranceVerificationSchema,
  });
}

export function submitFleetCar({
  request,
  carId,
}: {
  readonly request: Request;
  readonly carId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/cars/${pathSegment(carId)}/submissions`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: fleetCarSubmissionSchema,
  });
}
