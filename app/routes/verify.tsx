import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { ApiRequestError } from "~/api/api.server";
import {
  getAuthSession,
  isSecureAuthCookie,
  sendSignInOtp,
  verifySignInOtp,
} from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { verifyFormSchema } from "~/auth/auth-form-schema";
import {
  parsePendingOtp,
  pendingOtpClearCookie,
  pendingOtpCookieName,
  pendingOtpSetCookie,
  readCookieValue,
} from "~/auth/pending-otp";
import { safeRedirectPath } from "~/auth/referer";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/verify";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Verify email | Tripdly",
    description: "Enter the one-time code sent to your email to finish signing in.",
    path: "/verify",
    index: false,
  });

function readPendingOtp(request: Request) {
  return parsePendingOtp(
    readCookieValue(request.headers.get("Cookie"), pendingOtpCookieName(isSecureAuthCookie())),
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getAuthSession({ request });

    if (session) {
      throw redirect("/", { headers: NO_STORE });
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
  }

  const pending = readPendingOtp(request);

  if (!pending) {
    throw redirect("/auth", { headers: NO_STORE });
  }

  return { email: pending.email };
}

export async function action({ request }: Route.ActionArgs) {
  const pending = readPendingOtp(request);

  if (!pending) {
    throw redirect("/auth", { headers: NO_STORE });
  }

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "verify");
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));

  if (intent === "resend") {
    try {
      await sendSignInOtp({
        request,
        email: pending.email,
        role: "user",
        referralCode: pending.referralCode,
      });
      const headers = authResponseHeaders();
      headers.append("Set-Cookie", pendingOtpSetCookie(pending, isSecureAuthCookie()));
      return data({ error: undefined, notice: "A new code is on its way." }, { headers });
    } catch (error) {
      if (error instanceof ApiRequestError && error.kind === "aborted") {
        throw error;
      }

      return data(
        { error: authClientErrorMessage(error), notice: undefined },
        { status: authClientErrorStatus(error), headers: NO_STORE },
      );
    }
  }

  const parsed = verifyFormSchema.safeParse({ code: String(form.get("code") ?? "") });

  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code.", notice: undefined },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const response = await verifySignInOtp({
      request,
      email: pending.email,
      otp: parsed.data.code,
      role: "user",
    });
    const headers = authResponseHeaders(response.headers);
    headers.append("Set-Cookie", pendingOtpClearCookie(isSecureAuthCookie()));

    throw redirect(redirectTo, { headers });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (error instanceof Response) {
      throw error;
    }

    return data(
      { error: authClientErrorMessage(error), notice: undefined },
      { status: authClientErrorStatus(error), headers: NO_STORE },
    );
  }
}

export default function VerifyPage() {
  const { email } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Check your email</h1>
      <p className="mb-8 text-gray-600">
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>

      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="verify" />
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            spellCheck={false}
            placeholder="123456"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 tracking-[0.3em] focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        {actionData?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}
        {actionData?.notice ? (
          <p className="text-sm text-gray-700" aria-live="polite">
            {actionData.notice}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-11">
          {isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </Form>

      <Form method="post" className="mt-4">
        <input type="hidden" name="intent" value="resend" />
        <Button type="submit" variant="ghost" disabled={isSubmitting}>
          Resend code
        </Button>
      </Form>

      <p className="mt-6 text-sm text-gray-600">
        Wrong email?{" "}
        <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
          Start again
        </Link>
      </p>
    </div>
  );
}
