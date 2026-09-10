import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs, useOutletContext } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import {
  checkFleetOwnerPhoneVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  saveFleetOwnerDrivingCredentials,
  sendFleetOwnerPhoneVerification,
  submitFleetOwnerOnboarding,
  verifyFleetOwnerIdentity,
  verifyFleetOwnerPayout,
} from "~/api/fleet/onboarding/onboarding.server";
import {
  accountErrorMessage,
  accountErrorReply,
  accountRetryKey,
} from "~/api/fleet/onboarding/onboarding-errors.server";
import { HTTP_STATUS } from "~/api/http-status";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { FleetOwnerOnboardingPage } from "~/fleet/onboarding/fleet-owner-onboarding-page";
import {
  type OnboardingActionData,
  type OnboardingActionIntent,
  onboardingDriverLicenseReplacementFormSchema,
  onboardingDrivingFormSchema,
  onboardingIdentityFormSchema,
  onboardingPayoutFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "~/fleet/onboarding/onboarding-form-schema";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.onboarding";
import type { FleetOwnerOutletContext } from "./fleet-owner";

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
  const banks =
    onboarding.nextAction === "VERIFY_PAYOUT" ? (await getFleetOwnerBanks({ request })).data : [];
  return { banks, idempotencyKey: crypto.randomUUID() };
}

function invalid(intent: OnboardingActionIntent, error: string, phoneNumber?: string) {
  return data<OnboardingActionData>(
    { intent, error, phoneNumber, revalidate: false },
    { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
  );
}

function failure(intent: OnboardingActionIntent, error: unknown, phoneNumber?: string) {
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

function readIdempotencyKey(formData: FormData, intent: OnboardingActionIntent) {
  const parsed = idempotencyKeySchema.safeParse(formData.get("idempotencyKey"));
  if (!parsed.success) {
    return invalid(intent, parsed.error.issues[0]?.message ?? "Invalid idempotency key");
  }
  return parsed.data;
}

function invalidSubmission(
  intent: OnboardingActionIntent,
  idempotencyKey: string,
  submission: { reply: () => SubmissionResult<string[]> },
) {
  return data<OnboardingActionData>(
    {
      intent,
      idempotencyKey,
      revalidate: false,
      submission: submission.reply(),
    },
    { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
  );
}

function stageReply(
  intent: OnboardingActionIntent,
  idempotencyKey: string,
  error: unknown,
  submission: {
    reply: (options?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    }) => SubmissionResult<string[]>;
  },
  accountType: "INDIVIDUAL" | "BUSINESS" = "INDIVIDUAL",
) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;
  return data<OnboardingActionData>(
    {
      intent,
      idempotencyKey: accountRetryKey(error, idempotencyKey),
      revalidate: false,
      submission: submission.reply(accountErrorReply(error, accountType)),
    },
    { status, headers: NO_STORE },
  );
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

async function verifyIdentity(request: Request, formData: FormData) {
  const idempotencyKey = readIdempotencyKey(formData, "verify-identity");
  if (typeof idempotencyKey !== "string") return idempotencyKey;

  const submission = parseWithZod(formData, { schema: onboardingIdentityFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("verify-identity", idempotencyKey, submission);
  }

  try {
    await verifyFleetOwnerIdentity({
      request,
      idempotencyKey,
      body: submission.value,
    });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return stageReply(
      "verify-identity",
      idempotencyKey,
      error,
      submission,
      submission.value.accountType,
    );
  }
}

async function verifyPayout(request: Request, formData: FormData) {
  const idempotencyKey = readIdempotencyKey(formData, "verify-payout");
  if (typeof idempotencyKey !== "string") return idempotencyKey;

  const submission = parseWithZod(formData, { schema: onboardingPayoutFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("verify-payout", idempotencyKey, submission);
  }

  try {
    const { data: banks } = await getFleetOwnerBanks({ request });
    const bank = banks.find(({ code }) => code === submission.value.bankCode);
    if (!bank) {
      return data<OnboardingActionData>(
        {
          intent: "verify-payout",
          idempotencyKey,
          revalidate: false,
          submission: submission.reply({ fieldErrors: { bankCode: ["Select a bank"] } }),
        },
        { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
      );
    }

    await verifyFleetOwnerPayout({
      request,
      idempotencyKey,
      body: {
        bankName: bank.name,
        bankCode: bank.code,
        accountNumber: submission.value.accountNumber,
      },
    });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return stageReply("verify-payout", idempotencyKey, error, submission);
  }
}

function optionalFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : undefined;
}

async function saveDriving(request: Request, formData: FormData) {
  const idempotencyKey = readIdempotencyKey(formData, "save-driving");
  if (typeof idempotencyKey !== "string") return idempotencyKey;

  const submission = parseWithZod(formData, { schema: onboardingDrivingFormSchema });
  if (submission.status !== "success") {
    return invalidSubmission("save-driving", idempotencyKey, submission);
  }

  const sanitized = new FormData();
  sanitized.set("isOwnerDriver", String(submission.value.isOwnerDriver));
  for (const name of ["driversLicense", "lasdri"] as const) {
    const file = optionalFile(formData.get(name));
    if (file) sanitized.set(name, file);
  }

  try {
    await saveFleetOwnerDrivingCredentials({
      request,
      idempotencyKey,
      formData: sanitized,
    });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    return stageReply("save-driving", idempotencyKey, error, submission);
  }
}

async function submitAccount(request: Request, formData: FormData) {
  const idempotencyKey = readIdempotencyKey(formData, "submit-account");
  if (typeof idempotencyKey !== "string") return idempotencyKey;

  try {
    await submitFleetOwnerOnboarding({ request, idempotencyKey });
    return redirect("/fleet-owner/onboarding", { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;
    return data<OnboardingActionData>(
      {
        intent: "submit-account",
        idempotencyKey: accountRetryKey(error, idempotencyKey),
        revalidate: false,
        error: accountErrorMessage(error),
      },
      { status, headers: NO_STORE },
    );
  }
}

async function replaceDriverLicense(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, {
    schema: onboardingDriverLicenseReplacementFormSchema,
  });
  if (submission.status !== "success") {
    return data<OnboardingActionData>(
      {
        intent: "replace-driver-license",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }
  try {
    await replaceFleetOwnerDriverLicense({ request, file: submission.value.file });
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
    case "verify-identity":
      return verifyIdentity(request, formData);
    case "verify-payout":
      return verifyPayout(request, formData);
    case "save-driving":
      return saveDriving(request, formData);
    case "submit-account":
      return submitAccount(request, formData);
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
  const { onboarding } = useOutletContext<FleetOwnerOutletContext>();

  return (
    <FleetOwnerOnboardingPage
      actionData={actionData}
      banks={loaderData.banks}
      idempotencyKey={loaderData.idempotencyKey}
      onboarding={onboarding}
    />
  );
}
