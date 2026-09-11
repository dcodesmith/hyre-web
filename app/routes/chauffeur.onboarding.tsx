import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";
import { z } from "zod";

import { ApiRequestError, idempotencyKeyForRetry } from "~/api/api.server";
import {
  acceptChauffeurConsent,
  checkChauffeurPhoneVerification,
  exchangeChauffeurInvitation,
  getChauffeurOnboarding,
  sendChauffeurPhoneVerification,
  verifyChauffeurDriving,
  verifyChauffeurNin,
} from "~/api/chauffeurs/chauffeur-onboarding.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  type ChauffeurOnboardingActionData,
  type ChauffeurOnboardingIntent,
  chauffeurConsentFormSchema,
  chauffeurDrivingFormSchema,
  chauffeurNinFormSchema,
  chauffeurPhoneCodeFormSchema,
} from "~/chauffeur/chauffeur-onboarding-form-schema";
import { ChauffeurOnboardingPage } from "~/chauffeur/chauffeur-onboarding-page";
import {
  chauffeurOnboardingClearCookie,
  chauffeurOnboardingSetCookie,
  createChauffeurOnboardingSession,
  readChauffeurOnboardingSession,
} from "~/chauffeur/chauffeur-onboarding-session.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/chauffeur.onboarding";

const PATH = "/chauffeur/onboarding";
const SENSITIVE_NO_STORE = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const invitationTokenSchema = z.string().min(32).max(200);

export const meta = () =>
  buildPageMetadata({
    title: "Chauffeur Verification | Tripdly",
    description: "Complete your Tripdly chauffeur verification.",
    path: PATH,
    index: false,
  });

export function headers() {
  return SENSITIVE_NO_STORE;
}

function cleanRedirect(setCookie?: string) {
  const headers = new Headers(SENSITIVE_NO_STORE);
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return redirect(PATH, { headers });
}

async function exchangeInvitationToken(request: Request, tokenValue: string) {
  const existingSession = await readChauffeurOnboardingSession(request);
  const token = invitationTokenSchema.safeParse(tokenValue);
  if (!token.success) {
    return cleanRedirect(existingSession ? undefined : chauffeurOnboardingClearCookie());
  }

  try {
    const response = await exchangeChauffeurInvitation({ request, token: token.data });
    const session = createChauffeurOnboardingSession({
      token: response.data.sessionToken,
      expiresAt: response.data.sessionExpiresAt,
    });
    return cleanRedirect(await chauffeurOnboardingSetCookie(session));
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    return cleanRedirect(existingSession ? undefined : chauffeurOnboardingClearCookie());
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const tokenValue = url.searchParams.get("token");

  if (tokenValue !== null) {
    return exchangeInvitationToken(request, tokenValue);
  }

  const session = await readChauffeurOnboardingSession(request);
  if (!session) {
    return data(
      { onboarding: null, idempotencyKey: crypto.randomUUID() },
      { status: HTTP_STATUS.UNAUTHORIZED, headers: SENSITIVE_NO_STORE },
    );
  }

  try {
    const response = await getChauffeurOnboarding({
      request,
      sessionToken: session.token,
    });
    return {
      onboarding: response.data,
      idempotencyKey: crypto.randomUUID(),
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      const headers = new Headers(SENSITIVE_NO_STORE);
      headers.append("Set-Cookie", chauffeurOnboardingClearCookie());
      return data(
        { onboarding: null, idempotencyKey: crypto.randomUUID() },
        { status: HTTP_STATUS.UNAUTHORIZED, headers },
      );
    }
    throw error;
  }
}

function actionError(
  intent: ChauffeurOnboardingIntent,
  error: unknown,
  fallback: string,
  options?: {
    readonly idempotencyKey?: string;
    readonly submission?: ChauffeurOnboardingActionData["submission"];
  },
) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  const expected =
    error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const headers = new Headers(SENSITIVE_NO_STORE);
  if (error instanceof ApiRequestError) {
    const retryAfter = error.headers.get("Retry-After");
    if (retryAfter) {
      headers.set("Retry-After", retryAfter);
    }
    if (error.status === HTTP_STATUS.UNAUTHORIZED) {
      headers.append("Set-Cookie", chauffeurOnboardingClearCookie());
    }
  }

  return data<ChauffeurOnboardingActionData>(
    {
      intent,
      error: expected ? error.problem.detail : fallback,
      idempotencyKey: options?.idempotencyKey,
      revalidate: false,
      submission: options?.submission,
    },
    {
      status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers,
    },
  );
}

async function consentAction(request: Request, sessionToken: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: chauffeurConsentFormSchema });
  if (submission.status !== "success") {
    return data<ChauffeurOnboardingActionData>(
      {
        intent: "accept-consent",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: SENSITIVE_NO_STORE },
    );
  }

  try {
    await acceptChauffeurConsent({ request, sessionToken });
    return data<ChauffeurOnboardingActionData>(
      { intent: "accept-consent" },
      { headers: SENSITIVE_NO_STORE },
    );
  } catch (error) {
    return actionError("accept-consent", error, "Unable to save your consent. Please try again.");
  }
}

async function sendPhoneAction(request: Request, sessionToken: string) {
  try {
    const response = await sendChauffeurPhoneVerification({ request, sessionToken });
    return data<ChauffeurOnboardingActionData>(
      {
        intent: "send-phone",
        notice: `Code sent to ${response.data.phoneNumber}`,
        revalidate: false,
      },
      { headers: SENSITIVE_NO_STORE },
    );
  } catch (error) {
    return actionError("send-phone", error, "Unable to send a code. Please try again.");
  }
}

async function checkPhoneAction(request: Request, sessionToken: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: chauffeurPhoneCodeFormSchema });
  if (submission.status !== "success") {
    return data<ChauffeurOnboardingActionData>(
      {
        intent: "check-phone",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: SENSITIVE_NO_STORE },
    );
  }

  try {
    await checkChauffeurPhoneVerification({
      request,
      sessionToken,
      code: submission.value.code,
    });
    return data<ChauffeurOnboardingActionData>(
      { intent: "check-phone" },
      { headers: SENSITIVE_NO_STORE },
    );
  } catch (error) {
    return actionError("check-phone", error, "Unable to verify the code. Please try again.", {
      submission: submission.reply(),
    });
  }
}

async function ninAction(request: Request, sessionToken: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: chauffeurNinFormSchema });
  if (submission.status !== "success") {
    const idempotencyKey = formData.get("idempotencyKey");
    return data<ChauffeurOnboardingActionData>(
      {
        intent: "verify-nin",
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : "",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: SENSITIVE_NO_STORE },
    );
  }

  try {
    await verifyChauffeurNin({
      request,
      sessionToken,
      idempotencyKey: submission.value.idempotencyKey,
      nin: submission.value.nin,
    });
    return data<ChauffeurOnboardingActionData>(
      { intent: "verify-nin" },
      { headers: SENSITIVE_NO_STORE },
    );
  } catch (error) {
    return actionError("verify-nin", error, "Unable to verify your NIN. Please try again.", {
      idempotencyKey: idempotencyKeyForRetry(error, submission.value.idempotencyKey),
      submission: submission.reply(),
    });
  }
}

async function drivingAction(request: Request, sessionToken: string, formData: FormData) {
  const submission = parseWithZod(formData, { schema: chauffeurDrivingFormSchema });
  if (submission.status !== "success") {
    const idempotencyKey = formData.get("idempotencyKey");
    return data<ChauffeurOnboardingActionData>(
      {
        intent: "verify-driving",
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : "",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: SENSITIVE_NO_STORE },
    );
  }

  const body = new FormData();
  body.set("driversLicenseNumber", submission.value.driversLicenseNumber);
  body.set("selfie", submission.value.selfie);

  try {
    await verifyChauffeurDriving({
      request,
      sessionToken,
      idempotencyKey: submission.value.idempotencyKey,
      formData: body,
    });
    return data<ChauffeurOnboardingActionData>(
      { intent: "verify-driving" },
      { headers: SENSITIVE_NO_STORE },
    );
  } catch (error) {
    return actionError(
      "verify-driving",
      error,
      "Unable to complete driving verification. Please try again.",
      {
        idempotencyKey: idempotencyKeyForRetry(error, submission.value.idempotencyKey),
        submission: submission.reply({ resetForm: false }),
      },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const session = await readChauffeurOnboardingSession(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!session) {
    return data<ChauffeurOnboardingActionData>(
      {
        intent:
          intent === "accept-consent" ||
          intent === "send-phone" ||
          intent === "check-phone" ||
          intent === "verify-nin" ||
          intent === "verify-driving"
            ? intent
            : "accept-consent",
        error: "This verification session has expired. Ask your fleet owner for a new invitation.",
        revalidate: false,
      },
      { status: HTTP_STATUS.UNAUTHORIZED, headers: SENSITIVE_NO_STORE },
    );
  }

  if (intent === "accept-consent") return consentAction(request, session.token, formData);
  if (intent === "send-phone") return sendPhoneAction(request, session.token);
  if (intent === "check-phone") return checkPhoneAction(request, session.token, formData);
  if (intent === "verify-nin") return ninAction(request, session.token, formData);
  if (intent === "verify-driving") return drivingAction(request, session.token, formData);

  throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: SENSITIVE_NO_STORE });
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return (actionResult as ChauffeurOnboardingActionData | undefined)?.revalidate === false
    ? false
    : defaultShouldRevalidate;
}

export default function ChauffeurOnboardingRoute({ actionData, loaderData }: Route.ComponentProps) {
  return <ChauffeurOnboardingPage actionData={actionData} {...loaderData} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Unable to load verification</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please check your connection and retry.
        </p>
        <Button
          type="button"
          className="mt-5"
          disabled={revalidator.state !== "idle"}
          onClick={() => revalidator.revalidate()}
        >
          {revalidator.state === "idle" ? "Retry" : "Retrying…"}
        </Button>
      </div>
    </main>
  );
}
