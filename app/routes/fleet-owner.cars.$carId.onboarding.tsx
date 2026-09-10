import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import {
  createFleetInsuranceVerification,
  submitFleetCar,
  updateFleetDraftCarPricing,
  uploadFleetDraftCarDocuments,
  uploadFleetDraftCarImages,
} from "~/api/fleet/cars/car-onboarding.server";
import { getFleetCar } from "~/api/fleet/cars/cars.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  carOnboardingDocumentsFormSchema,
  carOnboardingImagesFormSchema,
  carOnboardingInsuranceFormSchema,
  carOnboardingPricingFormSchema,
  type FleetCarOnboardingActionData,
  type FleetCarOnboardingIntent,
} from "~/fleet/cars/car-onboarding-form-schema";
import { FleetCarOnboardingPage } from "~/fleet/cars/fleet-car-onboarding-page";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.$carId.onboarding";

const NO_STORE = { "Cache-Control": "private, no-store" };
const RETRY_MESSAGE = "Unable to complete this car onboarding step. Please try again.";
const idempotencyKeySchema = z.uuid();

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData?.car
      ? `Set Up ${loaderData.car.make} ${loaderData.car.model} | Tripdly Fleet`
      : "Set Up Car | Tripdly Fleet",
    description: "Add documents and photos, set pricing, and submit your car for review.",
    path: loaderData?.car
      ? `/fleet-owner/cars/${loaderData.car.id}/onboarding`
      : "/fleet-owner/cars",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { data: car } = await getFleetCar({ request, carId: params.carId });
  if (car.submittedAt) {
    return redirect(`/fleet-owner/cars/${car.id}`, { headers: NO_STORE });
  }
  return { car, idempotencyKey: crypto.randomUUID() };
}

function invalid(error: string, status: number = HTTP_STATUS.BAD_REQUEST) {
  return data<FleetCarOnboardingActionData>(
    { error, revalidate: false },
    { status, headers: NO_STORE },
  );
}

function invalidSubmission(
  intent: FleetCarOnboardingIntent,
  submission: { reply: () => FleetCarOnboardingActionData["submission"] },
) {
  return data<FleetCarOnboardingActionData>(
    { intent, revalidate: false, submission: submission.reply() },
    { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
  );
}

function failure(error: unknown) {
  if (error instanceof ApiRequestError && error.kind === "aborted") throw error;
  const expected =
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return data<FleetCarOnboardingActionData>(
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

function onboardingPath(carId: string) {
  return `/fleet-owner/cars/${carId}/onboarding`;
}

async function uploadDocuments(request: Request, carId: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: carOnboardingDocumentsFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("upload-documents", submission);
  }
  await uploadFleetDraftCarDocuments({ request, carId, ...submission.value });
  return redirect(onboardingPath(carId), { headers: NO_STORE });
}

async function uploadImages(request: Request, carId: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: carOnboardingImagesFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("upload-images", submission);
  }
  await uploadFleetDraftCarImages({ request, carId, images: submission.value.images });
  return redirect(onboardingPath(carId), { headers: NO_STORE });
}

async function savePricing(request: Request, carId: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: carOnboardingPricingFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("save-pricing", submission);
  }
  await updateFleetDraftCarPricing({ request, carId, body: submission.value });
  return redirect(onboardingPath(carId), { headers: NO_STORE });
}

async function verifyInsurance(request: Request, carId: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: carOnboardingInsuranceFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("verify-insurance", submission);
  }
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get("idempotencyKey"));
  if (!idempotencyKey.success) {
    return invalid(idempotencyKey.error.issues[0]?.message ?? "Invalid idempotency key");
  }
  await createFleetInsuranceVerification({
    request,
    carId,
    idempotencyKey: idempotencyKey.data,
    body: submission.value,
  });
  return redirect(onboardingPath(carId), { headers: NO_STORE });
}

async function executeAction(
  intent: FormDataEntryValue | null,
  request: Request,
  carId: string,
  formData: FormData,
) {
  switch (intent) {
    case "upload-documents":
      return uploadDocuments(request, carId, formData);
    case "upload-images":
      return uploadImages(request, carId, formData);
    case "save-pricing":
      return savePricing(request, carId, formData);
    case "verify-insurance":
      return verifyInsurance(request, carId, formData);
    case "submit-car":
      await submitFleetCar({ request, carId });
      return redirect(`/fleet-owner/cars/${carId}`, { headers: NO_STORE });
    default:
      return invalid("Unsupported car onboarding step.");
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  try {
    return await executeAction(formData.get("intent"), request, params.carId, formData);
  } catch (error) {
    if (error instanceof Response) throw error;
    return failure(error);
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return (actionResult as FleetCarOnboardingActionData | undefined)?.revalidate === false
    ? false
    : defaultShouldRevalidate;
}

export default function FleetOwnerCarOnboardingRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <FleetCarOnboardingPage
      actionData={actionData}
      car={loaderData.car}
      idempotencyKey={loaderData.idempotencyKey}
    />
  );
}
