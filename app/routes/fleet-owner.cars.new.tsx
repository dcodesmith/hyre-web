import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import {
  createFleetDraftCar,
  createFleetVehicleVerification,
  getFleetVehicleVerification,
} from "~/api/fleet/cars/car-onboarding.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  carOnboardingPlateFormSchema,
  type NewFleetCarActionData,
} from "~/fleet/cars/car-onboarding-form-schema";
import { FleetCarPlateVerificationPage } from "~/fleet/cars/fleet-car-plate-verification-page";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.new";

const NO_STORE = { "Cache-Control": "private, no-store" };
const RETRY_MESSAGE = "Unable to complete this car onboarding step. Please try again.";
const idempotencyKeySchema = z.uuid();
const verificationIdSchema = z.string().trim().min(1);

export const meta = () =>
  buildPageMetadata({
    title: "Add a Car | Tripdly Fleet",
    description: "Verify a vehicle and add it to your Tripdly fleet.",
    path: "/fleet-owner/cars/new",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export function loader(_args: Route.LoaderArgs) {
  return { idempotencyKey: crypto.randomUUID() };
}

function invalid(error: string, status: number = HTTP_STATUS.BAD_REQUEST) {
  return data<NewFleetCarActionData>({ error, revalidate: false }, { status, headers: NO_STORE });
}

function failure(error: unknown) {
  if (error instanceof ApiRequestError && error.kind === "aborted") throw error;
  const expected =
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return data<NewFleetCarActionData>(
    {
      error: expected ? error.problem.detail : RETRY_MESSAGE,
      ...(error instanceof ApiRequestError && error.kind === "http" ? {} : { revalidate: false }),
    },
    {
      status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers: NO_STORE,
    },
  );
}

async function verifyPlate(request: Request, formData: FormData) {
  const plate = carOnboardingPlateFormSchema.safeParse({
    plateNumber: formData.get("plateNumber"),
  });
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get("idempotencyKey"));
  if (!plate.success) {
    return invalid(plate.error.issues[0]?.message ?? "Enter a valid Nigerian number plate");
  }
  if (!idempotencyKey.success) {
    return invalid(idempotencyKey.error.issues[0]?.message ?? "Invalid idempotency key");
  }

  try {
    const { data: verification } = await createFleetVehicleVerification({
      request,
      idempotencyKey: idempotencyKey.data,
      body: plate.data,
    });
    if (!verification.eligibility.isEligible) {
      return data<NewFleetCarActionData>(
        {
          error:
            "This vehicle is not eligible. Use a vehicle from 2015 or newer, or check the plate and try again.",
          revalidate: false,
          verification,
        },
        { status: 422, headers: NO_STORE },
      );
    }
    return data<NewFleetCarActionData>({ verification }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

async function reconcileDraft(request: Request, verificationId: string, error: ApiRequestError) {
  try {
    const { data: verification } = await getFleetVehicleVerification({
      request,
      verificationId,
    });
    if (verification.carId) {
      return redirect(`/fleet-owner/cars/${verification.carId}/onboarding`, {
        headers: NO_STORE,
      });
    }
    return data<NewFleetCarActionData>(
      { error: RETRY_MESSAGE, revalidate: false, verification },
      { status: error.status, headers: NO_STORE },
    );
  } catch {
    return failure(error);
  }
}

async function createDraft(request: Request, formData: FormData) {
  const verificationId = verificationIdSchema.safeParse(formData.get("verificationId"));
  if (!verificationId.success) {
    return invalid(verificationId.error.issues[0]?.message ?? "Invalid vehicle verification");
  }

  try {
    const { data: car } = await createFleetDraftCar({
      request,
      verificationId: verificationId.data,
    });
    return redirect(`/fleet-owner/cars/${car.id}/onboarding`, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "network") {
      return reconcileDraft(request, verificationId.data, error);
    }
    return failure(error);
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  switch (formData.get("intent")) {
    case "verify-plate":
      return verifyPlate(request, formData);
    case "create-draft":
      return createDraft(request, formData);
    default:
      throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return (actionResult as NewFleetCarActionData | undefined)?.revalidate === false
    ? false
    : defaultShouldRevalidate;
}

export default function FleetOwnerNewCarRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <FleetCarPlateVerificationPage
      actionData={actionData}
      idempotencyKey={loaderData.idempotencyKey}
    />
  );
}
