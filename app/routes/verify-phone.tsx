import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect } from "react-router";
import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  checkCurrentUserPhoneVerification,
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
} from "~/api/users/users.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import {
  type PhoneVerificationActionData,
  PhoneVerificationForm,
} from "~/auth/phone-verification-form";
import {
  phoneVerificationCheckSchema,
  phoneVerificationSendSchema,
} from "~/auth/phone-verification-schema";
import { authPath, safeRedirectPath } from "~/auth/referer";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/verify-phone";

export const meta = () =>
  buildPageMetadata({
    title: "Verify phone | Tripdly",
    description: "Verify your phone number to secure your Tripdly account and bookings.",
    path: "/verify-phone",
    index: false,
  });

export function headers() {
  return AUTH_NO_STORE;
}

function completionPath(request: Request) {
  return safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));
}

function loginRedirect(request: Request) {
  const url = new URL(request.url);
  const redirectTo =
    url.searchParams.get("change") === "phone"
      ? safeRedirectPath(`${url.pathname}${url.search}`)
      : completionPath(request);

  return redirect(authPath("/auth", { redirectTo }), {
    headers: AUTH_NO_STORE,
  });
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  try {
    const profile = (await getCurrentUserProfile({ request })).data;
    const changingPhone =
      profile.phoneVerified && new URL(request.url).searchParams.get("change") === "phone";

    if (profile.phoneVerified && !changingPhone) {
      throw redirect(completionPath(request), { headers: AUTH_NO_STORE });
    }

    return {
      changingPhone,
      initialPhoneNumber: profile.phoneNumber ?? undefined,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (isUnauthorized(error)) {
      throw loginRedirect(request);
    }
    throw error;
  }
}

function failedVerification(
  request: Request,
  intent: PhoneVerificationActionData["intent"],
  phoneNumber: string,
  submission: {
    reply(options?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    }): PhoneVerificationActionData["submission"];
  },
  error: unknown,
  maskedPhoneNumber?: string,
) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }
  if (isUnauthorized(error)) {
    throw loginRedirect(request);
  }

  const expected =
    error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = expected
    ? error.problem.detail
    : "Unable to verify your phone. Please try again.";
  const fieldErrors =
    error instanceof ApiRequestError &&
    intent === "check-phone" &&
    error.status === HTTP_STATUS.UNPROCESSABLE_ENTITY &&
    error.problem.errorCode === "PHONE_VERIFICATION_CODE_INVALID"
      ? { code: [message] }
      : undefined;
  const responseStatus = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;

  return data<PhoneVerificationActionData>(
    {
      intent,
      maskedPhoneNumber,
      phoneNumber,
      submission: submission.reply(fieldErrors ? { fieldErrors } : { formErrors: [message] }),
    },
    { status: responseStatus, headers: AUTH_NO_STORE },
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "send-phone" && intent !== "check-phone") {
    throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE });
  }

  if (intent === "send-phone") {
    const submission = parseWithZod(formData, { schema: phoneVerificationSendSchema });
    const phoneEntry = formData.get("phoneNumber");
    const maskedEntry = formData.get("maskedPhoneNumber");
    const maskedPhoneNumber =
      typeof maskedEntry === "string" && maskedEntry ? maskedEntry : undefined;

    if (submission.status !== "success") {
      return data<PhoneVerificationActionData>(
        {
          intent,
          maskedPhoneNumber,
          phoneNumber: typeof phoneEntry === "string" ? phoneEntry : undefined,
          submission: submission.reply(),
        },
        { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
      );
    }

    try {
      const result = (
        await sendCurrentUserPhoneVerification({
          request,
          phoneNumber: submission.value.phoneNumber,
        })
      ).data;

      if (result.status === "VERIFIED") {
        throw redirect(completionPath(request), { headers: AUTH_NO_STORE });
      }

      return data<PhoneVerificationActionData>(
        {
          intent,
          maskedPhoneNumber: result.phoneNumber,
          notice: `Code sent to ${result.phoneNumber}.`,
          phoneNumber: submission.value.phoneNumber,
          submission: submission.reply(),
        },
        { headers: AUTH_NO_STORE },
      );
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }
      return failedVerification(
        request,
        intent,
        submission.value.phoneNumber,
        submission,
        error,
        maskedPhoneNumber,
      );
    }
  }

  const submission = parseWithZod(formData, { schema: phoneVerificationCheckSchema });
  const phoneEntry = formData.get("phoneNumber");
  const phoneNumber = typeof phoneEntry === "string" ? phoneEntry : "";
  const maskedEntry = formData.get("maskedPhoneNumber");
  const maskedPhoneNumber =
    typeof maskedEntry === "string" && maskedEntry ? maskedEntry : undefined;

  if (submission.status !== "success") {
    return data<PhoneVerificationActionData>(
      { intent, maskedPhoneNumber, phoneNumber, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    const result = (
      await checkCurrentUserPhoneVerification({
        request,
        phoneNumber: submission.value.phoneNumber,
        code: submission.value.code,
      })
    ).data;

    if (result.status === "VERIFIED") {
      throw redirect(completionPath(request), { headers: AUTH_NO_STORE });
    }

    return data<PhoneVerificationActionData>(
      {
        intent,
        maskedPhoneNumber: result.phoneNumber,
        notice: `Verification is still pending for ${result.phoneNumber}.`,
        phoneNumber: submission.value.phoneNumber,
        submission: submission.reply(),
      },
      { headers: AUTH_NO_STORE },
    );
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return failedVerification(request, intent, phoneNumber, submission, error, maskedPhoneNumber);
  }
}

export default function VerifyPhonePage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <PhoneVerificationForm
      actionData={actionData}
      changingPhone={loaderData.changingPhone}
      initialPhoneNumber={loaderData.initialPhoneNumber}
    />
  );
}
