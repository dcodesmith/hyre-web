import { parseWithZod } from "@conform-to/zod/v4";
import { data, type ShouldRevalidateFunctionArgs } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  checkCurrentUserPhoneVerification,
  checkGuestPhoneVerification,
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
  sendGuestPhoneVerification,
} from "~/api/users/users.server";
import {
  phoneVerificationCheckSchema,
  phoneVerificationSendSchema,
} from "~/auth/phone-verification-schema";
import { readAuthUser } from "~/auth/session.server";
import type { Route } from "./+types/api.phone-verification";

const NO_STORE = { "Cache-Control": "private, no-store" };
const VERIFY_ERROR = "Unable to verify your phone. Please try again.";

export type PhoneVerificationData = {
  readonly intent: "send-phone" | "check-phone" | null;
  readonly phoneNumber: string | null;
  readonly phoneVerified: boolean;
  readonly verificationToken?: string | null;
  readonly maskedPhoneNumber: string | null;
  readonly notice: string | null;
  readonly error: string | null;
  readonly fieldErrors: {
    readonly phoneNumber?: readonly string[];
    readonly code?: readonly string[];
  } | null;
};

function verifiedProfile(phoneNumber: string | null): PhoneVerificationData {
  return {
    intent: null,
    phoneNumber,
    phoneVerified: true,
    verificationToken: null,
    maskedPhoneNumber: null,
    notice: null,
    error: null,
    fieldErrors: null,
  };
}

function unverifiedProfile(phoneNumber: string | null = null): PhoneVerificationData {
  return {
    ...verifiedProfile(phoneNumber),
    phoneVerified: false,
  };
}

function verificationStatus(
  result: { readonly status: "PENDING" | "VERIFIED"; readonly verificationToken?: unknown },
  signedIn: boolean,
) {
  const verificationToken =
    typeof result.verificationToken === "string" && result.verificationToken.length > 0
      ? result.verificationToken
      : null;
  return {
    phoneVerified: result.status === "VERIFIED" && (signedIn || verificationToken != null),
    verificationToken,
  };
}

function failure(
  intent: PhoneVerificationData["intent"],
  phoneNumber: string | null,
  error: unknown,
  maskedPhoneNumber: string | null = null,
) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  const expected =
    error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = expected ? error.problem.detail : VERIFY_ERROR;
  const invalidCode =
    error instanceof ApiRequestError &&
    intent === "check-phone" &&
    error.status === HTTP_STATUS.UNPROCESSABLE_ENTITY &&
    error.problem.errorCode === "PHONE_VERIFICATION_CODE_INVALID";

  return data<PhoneVerificationData>(
    {
      intent,
      phoneNumber,
      phoneVerified: false,
      verificationToken: null,
      maskedPhoneNumber,
      notice: null,
      error: invalidCode ? null : message,
      fieldErrors: invalidCode ? { code: [message] } : null,
    },
    {
      status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers: NO_STORE,
    },
  );
}

export function shouldRevalidate({
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // A send or check revalidates this loader and would replace the action
  // result with the profile before the booking card can read it.
  return formAction?.includes("/api/phone-verification") ? false : defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    return data(unverifiedProfile(), { headers: NO_STORE });
  }

  try {
    const profile = (await getCurrentUserProfile({ request })).data;
    return data(
      profile.phoneVerified
        ? verifiedProfile(profile.phoneNumber)
        : {
            intent: null,
            phoneNumber: profile.phoneNumber,
            phoneVerified: false,
            verificationToken: null,
            maskedPhoneNumber: null,
            notice: null,
            error: null,
            fieldErrors: null,
          },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      return data(unverifiedProfile(), { headers: NO_STORE });
    }

    return data<PhoneVerificationData>(
      {
        intent: null,
        phoneNumber: null,
        phoneVerified: false,
        verificationToken: null,
        maskedPhoneNumber: null,
        notice: null,
        error: error instanceof ApiRequestError ? error.problem.detail : VERIFY_ERROR,
        fieldErrors: null,
      },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const [user, formData] = await Promise.all([readAuthUser(request), request.formData()]);
  const signedIn = user != null;
  const intent = formData.get("intent");
  if (intent !== "send-phone" && intent !== "check-phone") {
    return data<PhoneVerificationData>(
      {
        intent: null,
        phoneNumber: null,
        phoneVerified: false,
        verificationToken: null,
        maskedPhoneNumber: null,
        notice: null,
        error: "Choose whether to send or check a verification code.",
        fieldErrors: null,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  const maskedEntry = formData.get("maskedPhoneNumber");
  const maskedPhoneNumber = typeof maskedEntry === "string" && maskedEntry ? maskedEntry : null;

  if (intent === "send-phone") {
    const submission = parseWithZod(formData, { schema: phoneVerificationSendSchema });
    const phoneEntry = formData.get("phoneNumber");
    const phoneNumber = typeof phoneEntry === "string" ? phoneEntry : null;
    if (submission.status !== "success") {
      return data<PhoneVerificationData>(
        {
          intent,
          phoneNumber,
          phoneVerified: false,
          verificationToken: null,
          maskedPhoneNumber,
          notice: null,
          error: null,
          fieldErrors: { phoneNumber: submission.error?.phoneNumber ?? [] },
        },
        { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
      );
    }

    try {
      const result = (
        signedIn
          ? await sendCurrentUserPhoneVerification({
              request,
              phoneNumber: submission.value.phoneNumber,
            })
          : await sendGuestPhoneVerification({
              request,
              phoneNumber: submission.value.phoneNumber,
            })
      ).data;
      return data<PhoneVerificationData>(
        {
          intent,
          phoneNumber: submission.value.phoneNumber,
          ...verificationStatus(result, signedIn),
          maskedPhoneNumber: result.phoneNumber,
          notice: result.status === "VERIFIED" ? null : `Code sent to ${result.phoneNumber}.`,
          error: null,
          fieldErrors: null,
        },
        { headers: NO_STORE },
      );
    } catch (error) {
      return failure(intent, submission.value.phoneNumber, error, maskedPhoneNumber);
    }
  }

  const submission = parseWithZod(formData, { schema: phoneVerificationCheckSchema });
  const phoneEntry = formData.get("phoneNumber");
  const phoneNumber = typeof phoneEntry === "string" ? phoneEntry : "";
  if (submission.status !== "success") {
    return data<PhoneVerificationData>(
      {
        intent,
        phoneNumber,
        phoneVerified: false,
        verificationToken: null,
        maskedPhoneNumber,
        notice: null,
        error: null,
        fieldErrors: {
          phoneNumber: submission.error?.phoneNumber ?? undefined,
          code: submission.error?.code ?? undefined,
        },
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const result = (
      signedIn
        ? await checkCurrentUserPhoneVerification({
            request,
            phoneNumber: submission.value.phoneNumber,
            code: submission.value.code,
          })
        : await checkGuestPhoneVerification({
            request,
            phoneNumber: submission.value.phoneNumber,
            code: submission.value.code,
          })
    ).data;
    return data<PhoneVerificationData>(
      {
        intent,
        phoneNumber: submission.value.phoneNumber,
        ...verificationStatus(result, signedIn),
        maskedPhoneNumber: result.phoneNumber,
        notice:
          result.status === "VERIFIED"
            ? null
            : `Verification is still pending for ${result.phoneNumber}.`,
        error: null,
        fieldErrors: null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return failure(intent, submission.value.phoneNumber, error, maskedPhoneNumber);
  }
}
