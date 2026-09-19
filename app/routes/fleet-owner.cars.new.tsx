import { parseWithZod } from "@conform-to/zod/v4";
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
import { ineligibleFleetVehicleMessage } from "~/fleet/cars/fleet-car";
import { FleetCarPlateVerificationPage } from "~/fleet/cars/fleet-car-plate-verification-page";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.new";

const NO_STORE = { "Cache-Control": "private, no-store" };
const RETRY_MESSAGE = "Unable to complete this car onboarding step. Please try again.";
const DRAFT_RETRY_MESSAGE = "Unable to save this car. Please try again.";
const IDEMPOTENCY_KEY_REUSED = "VERIFICATION_IDEMPOTENCY_KEY_REUSED";
const idempotencyKeySchema = z.uuid();
const verificationIdSchema = z.uuid();

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

function isIdempotencyKeyReused(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.problem.errorCode === IDEMPOTENCY_KEY_REUSED
  );
}

function failure(error: unknown) {
  if (error instanceof ApiRequestError && error.kind === "aborted") throw error;
  const expected =
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR &&
    !isIdempotencyKeyReused(error);
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
  const submission = parseWithZod(formData, { schema: carOnboardingPlateFormSchema });
  if (submission.status !== "success") {
    return data<NewFleetCarActionData>(
      { revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get("idempotencyKey"));
  if (!idempotencyKey.success) {
    return invalid(idempotencyKey.error.issues[0]?.message ?? "Invalid idempotency key");
  }

  try {
    const { data: verification } = await createFleetVehicleVerification({
      request,
      idempotencyKey: idempotencyKey.data,
      body: submission.value,
    }).catch((error: unknown) => {
      if (!isIdempotencyKeyReused(error)) throw error;
      return createFleetVehicleVerification({
        request,
        idempotencyKey: crypto.randomUUID(),
        body: submission.value,
      });
    });
    if (!verification.eligibility.isEligible) {
      return data<NewFleetCarActionData>(
        {
          error: ineligibleFleetVehicleMessage(verification.eligibility.minimumYear),
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

function draftFailure(error: unknown, verification: NewFleetCarActionData["verification"]) {
  const expected =
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return data<NewFleetCarActionData>(
    {
      error: expected ? error.problem.detail : DRAFT_RETRY_MESSAGE,
      revalidate: false,
      verification,
    },
    {
      status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers: NO_STORE,
    },
  );
}

async function recoverDraft(request: Request, verificationId: string, error: unknown) {
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
    return draftFailure(error, verification);
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
    if (error instanceof ApiRequestError && error.kind === "aborted") throw error;
    return recoverDraft(request, verificationId.data, error);
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
