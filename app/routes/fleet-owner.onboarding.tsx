import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import {
  checkFleetOwnerPhoneVerification,
  createFleetOwnerAccountVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  sendFleetOwnerPhoneVerification,
} from "~/api/fleet/onboarding/onboarding.server";
import { HTTP_STATUS } from "~/api/http-status";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { FleetOwnerOnboardingPage } from "~/fleet/onboarding/fleet-owner-onboarding-page";
import {
  type OnboardingActionData,
  onboardingAccountFormSchema,
  onboardingDriverLicenseReplacementFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "~/fleet/onboarding/onboarding-form-schema";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.onboarding";

const NO_STORE = { "Cache-Control": "private, no-store" };
const RETRY_MESSAGE = "Unable to complete this onboarding step. Please try again.";
const idempotencyKeySchema = z.uuid();

export const meta = () =>
  buildPageMetadata({
    title: "Verify Fleet Owner Account | Tripdly",
    description: "Verify your account before managing cars on Tripdly.",
    path: "/fleet-owner/onboarding",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { onboarding } = context.get(fleetOwnerContext);
  const needsBanks =
    onboarding.status === "ACTION_REQUIRED" &&
    onboarding.emailVerified &&
    onboarding.phone.verified;
  const banks = needsBanks ? (await getFleetOwnerBanks({ request })).data : [];
  return { banks, idempotencyKey: crypto.randomUUID() };
}

function invalid(intent: OnboardingActionData["intent"], error: string, phoneNumber?: string) {
  return data<OnboardingActionData>(
    { intent, error, phoneNumber, revalidate: false },
    { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
  );
}

function failure(intent: OnboardingActionData["intent"], error: unknown, phoneNumber?: string) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  const isExpected =
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const body: OnboardingActionData = {
    intent,
    error: isExpected ? error.problem.detail : RETRY_MESSAGE,
    phoneNumber,
    ...(error instanceof ApiRequestError && error.kind === "http" ? {} : { revalidate: false }),
  };
  return data<OnboardingActionData>(body, {
    status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
    headers: NO_STORE,
  });
}

async function sendPhone(request: Request, formData: FormData) {
  const parsed = onboardingPhoneFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid("send-phone", parsed.error.issues[0]?.message ?? "Enter a valid phone number");
  }

  try {
    const { data: result } = await sendFleetOwnerPhoneVerification({
      request,
      body: parsed.data,
    });
    if (result.status === "VERIFIED") {
      return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
    }
    return data<OnboardingActionData>(
      {
        intent: "send-phone",
        notice: `Code sent to ${result.phoneNumber}`,
        phoneNumber: parsed.data.phoneNumber,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return failure("send-phone", error, parsed.data.phoneNumber);
  }
}

async function checkPhone(request: Request, formData: FormData) {
  const parsed = onboardingPhoneCheckFormSchema.safeParse(Object.fromEntries(formData));
  const phoneEntry = formData.get("phoneNumber");
  const phoneNumber = typeof phoneEntry === "string" ? phoneEntry : undefined;
  if (!parsed.success) {
    return invalid(
      "check-phone",
      parsed.error.issues[0]?.message ?? "Enter a valid verification code",
      phoneNumber,
    );
  }

  try {
    await checkFleetOwnerPhoneVerification({ request, body: parsed.data });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return failure("check-phone", error, parsed.data.phoneNumber);
  }
}

function optionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : undefined;
}

async function verifyAccount(request: Request, formData: FormData) {
  const idempotencyKey = idempotencyKeySchema.safeParse(formData.get("idempotencyKey"));
  const bankCodeEntry = formData.get("bankCode");
  const bankCode = typeof bankCodeEntry === "string" ? bankCodeEntry : "";
  if (!idempotencyKey.success) {
    return invalid(
      "verify-account",
      idempotencyKey.error.issues[0]?.message ?? "Invalid idempotency key",
    );
  }

  try {
    const { data: banks } = await getFleetOwnerBanks({ request });
    const bank = banks.find(({ code }) => code === bankCode);
    if (!bank) {
      return invalid("verify-account", "Select a bank");
    }

    const sanitized = new FormData();
    for (const name of [
      "accountType",
      "nin",
      "isOwnerDriver",
      "accountNumber",
      "businessName",
      "registrationNumber",
      "registrationType",
    ]) {
      const value = formData.get(name);
      if (typeof value === "string" && value !== "") sanitized.set(name, value);
    }
    sanitized.set("bankCode", bank.code);
    sanitized.set("bankName", bank.name);
    for (const name of ["driversLicense", "lasdri"] as const) {
      const file = optionalFile(formData.get(name));
      if (file) sanitized.set(name, file);
    }

    const parsed = onboardingAccountFormSchema.safeParse(Object.fromEntries(sanitized));
    if (!parsed.success) {
      return invalid(
        "verify-account",
        parsed.error.issues[0]?.message ?? "Check your account details",
      );
    }

    await createFleetOwnerAccountVerification({
      request,
      idempotencyKey: idempotencyKey.data,
      formData: sanitized,
    });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return failure("verify-account", error);
  }
}

async function replaceDriverLicense(request: Request, formData: FormData) {
  const parsed = onboardingDriverLicenseReplacementFormSchema.safeParse({
    file: formData.get("file"),
  });
  if (!parsed.success) {
    return invalid(
      "replace-driver-license",
      parsed.error.issues[0]?.message ?? "Choose a valid driver's licence file",
    );
  }
  try {
    await replaceFleetOwnerDriverLicense({ request, file: parsed.data.file });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return failure("replace-driver-license", error);
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  switch (formData.get("intent")) {
    case "send-phone":
      return sendPhone(request, formData);
    case "check-phone":
      return checkPhone(request, formData);
    case "verify-account":
      return verifyAccount(request, formData);
    case "replace-driver-license":
      return replaceDriverLicense(request, formData);
    default:
      throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as OnboardingActionData | undefined)?.revalidate === false) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function FleetOwnerOnboardingRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <FleetOwnerOnboardingPage
      actionData={actionData}
      banks={loaderData.banks}
      idempotencyKey={loaderData.idempotencyKey}
    />
  );
}
