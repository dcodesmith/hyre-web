import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { ApiRequestError } from "~/api/api.server";
import { getAuthSession, isSecureAuthCookie, sendSignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { loginFormSchema } from "~/auth/auth-form-schema";
import { pendingOtpSetCookie } from "~/auth/pending-otp";
import { safeRedirectPath } from "~/auth/referer";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/auth";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Log in | Tripdly",
    description: "Sign in or create your Tripdly account with a one-time email code.",
    path: "/auth",
    index: false,
  });

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

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = loginFormSchema.safeParse({
    email: String(form.get("email") ?? ""),
    referralCode: String(form.get("referralCode") ?? ""),
    acceptTerms: String(form.get("acceptTerms") ?? ""),
  });

  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? "Check your details and try again." },
      { status: 400, headers: NO_STORE },
    );
  }

  const referralCode = parsed.data.referralCode || undefined;
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));

  try {
    await sendSignInOtp({
      request,
      email: parsed.data.email,
      role: "user",
      referralCode,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return data(
      { error: authClientErrorMessage(error) },
      { status: authClientErrorStatus(error), headers: NO_STORE },
    );
  }

  const headers = authResponseHeaders();
  headers.append(
    "Set-Cookie",
    pendingOtpSetCookie(
      {
        email: parsed.data.email,
        referralCode,
      },
      isSecureAuthCookie(),
    ),
  );

  throw redirect(
    redirectTo === "/" ? "/verify" : `/verify?redirectTo=${encodeURIComponent(redirectTo)}`,
    {
      headers,
    },
  );
}

export default function AuthPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const referralFromUrl = searchParams.get("ref")?.trim().toUpperCase() ?? "";
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome back</h1>
      <p className="mb-8 text-gray-600">Enter your email to sign in or create your account.</p>

      <Form method="post" className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        {referralFromUrl ? (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-gray-700">
            You&apos;re signing up with referral code: <strong>{referralFromUrl}</strong>
            <input type="hidden" name="referralCode" value={referralFromUrl} />
          </p>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700">
              Referral code <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="referralCode"
              name="referralCode"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. ABCD2345"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            />
          </div>
        )}

        <label htmlFor="acceptTerms" className="flex items-start gap-2.5 text-sm text-gray-600">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            value="on"
            required
            className="mt-1 size-4"
          />
          <span>
            I agree to Tripdly&apos;s{" "}
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        {actionData?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-11">
          {isSubmitting ? "Sending code…" : "Send code"}
        </Button>
      </Form>
    </div>
  );
}
