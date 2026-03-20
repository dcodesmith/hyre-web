import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CogIcon } from "@heroicons/react/24/outline";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  data,
  redirect,
  Link,
  useActionData,
  useLoaderData,
} from "react-router";
import { Form } from "~/components/CSRFForm";
import { LoginSchema } from "~/schemas/auth.schema";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { useIsPending } from "~/lib/utils";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { prisma } from "~/modules/db/db.server";
import { AuthSplitLayout } from "~/components/layout/AuthSplitLayout";
import { userHasRole } from "~/utils/shared/roles";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import { sendOTPAndRedirect } from "~/utils/server/auth-helpers.server";
import { ArrowRight } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (user) {
    // If already logged in as fleet owner, redirect to dashboard
    if (userHasRole(user, "fleetOwner")) {
      throw redirect("/fleet-owner");
    }
    // Otherwise redirect to home
    throw redirect("/");
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");

  if (authError) {
    cookie.unset("auth:error");
  }

  return data(
    { authEmail, authError },
    authError ? { headers: { "Set-Cookie": await commitSession(cookie) } } : undefined,
  );
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const formData = await request.clone().formData();
  const url = new URL(request.url);

  // Validate the form data
  const submission = parseWithZod(formData, { schema: LoginSchema });
  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");
  const { email, acceptTerms } = submission.value;
  const role = "fleetOwner" as const;

  try {
    // Check if user exists and validate role
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (existingUser && !userHasRole(existingUser, role)) {
      // Log security event without revealing information to the user
      logger.warn("User attempted fleet owner login with wrong role", {
        email,
        attemptedRole: role,
        actualRoles: existingUser.roles.map((r) => r.name),
      });
      return data(
        { error: "We couldn't start the login process. Please check your details and try again." },
        { status: 400 },
      );
    }

    // Send OTP and redirect to verify page
    // Pass acceptTerms for consent tracking
    return sendOTPAndRedirect(request, email, role, redirectTo, undefined, acceptTerms);
  } catch (error) {
    logger.error("Error sending OTP for fleet owner", { error });

    // For same-route failures, only return actionData.error
    // Don't set auth:error cookie to avoid duplication and stale state
    return data(
      { error: error instanceof Error ? error.message : "Failed to send verification code" },
      { status: 500 },
    );
  }
}

export default function FleetOwnerLogin() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const isPending = useIsPending();

  let errorMessage: string | undefined;
  if (actionData?.error) {
    errorMessage = typeof actionData.error === "string" ? actionData.error : "An error occurred";
  } else if (typeof authError === "string") {
    errorMessage = authError;
  } else if (authError) {
    errorMessage = "An error occurred";
  }

  const [form, { email, acceptTerms }] = useForm({
    defaultValue: {
      email: authEmail || "",
    },
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
  });

  const acceptTermsControl = useInputControl(acceptTerms);

  return (
    <AuthSplitLayout>
      <div className="fade-up anim-delay-100 mb-8">
        <h2 className="mb-1 text-[2rem] font-normal leading-snug text-[#1A1814]">
          Fleet Owner Login
        </h2>
        <p className="text-sm font-light text-neutral-500">
          Enter your email to login to your fleet owner account.
        </p>
      </div>

      <div className="fade-up anim-delay-200">
        <Form method="post" {...getFormProps(form)}>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor={email.id}
                className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500"
              >
                Email address
              </label>
              <Input
                className={`h-11 rounded-lg border-neutral-200 px-4 text-[#1A1814] placeholder:text-neutral-400 focus-visible:ring-[#B8922A]/20 ${
                  email.errors
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus-visible:border-[#B8922A]"
                }`}
                {...getInputProps(email, { type: "email" })}
                placeholder="you@example.com"
              />
              {email.errors && (
                <div className="text-sm text-destructive">{email.errors.join(", ")}</div>
              )}
            </div>

            <div className="my-1 h-px bg-neutral-100" />

            <div className="space-y-1">
              <label
                htmlFor={acceptTerms.id}
                className="flex cursor-pointer items-start gap-2.5 text-xs font-light leading-relaxed text-neutral-500"
              >
                <Checkbox
                  id={acceptTerms.id}
                  name={acceptTerms.name}
                  className="shrink-0"
                  checked={acceptTermsControl.value === "on"}
                  onCheckedChange={(checked) => {
                    acceptTermsControl.change(checked ? "on" : "");
                  }}
                  onBlur={acceptTermsControl.blur}
                />
                <span>
                  I agree to Tripdly&apos;s{" "}
                  <Link
                    to="/terms"
                    className="text-[#B8922A] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    className="text-[#B8922A] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {acceptTerms.errors && (
                <div className="text-sm text-destructive">{acceptTerms.errors.join(", ")}</div>
              )}
            </div>

            {errorMessage && (
              <span className="mb-1 text-sm text-destructive dark:text-destructive-foreground">
                {errorMessage}
              </span>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-[#1A1814] px-6 py-3.5 text-xs font-medium uppercase tracking-[0.08em] text-white hover:bg-neutral-800"
              disabled={isPending}
            >
              {isPending ? (
                <CogIcon className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex gap-2">
                  Continue with Email <ArrowRight />
                </span>
              )}
            </Button>
          </div>
        </Form>
      </div>

      <p className="fade-up anim-delay-300 mt-6 text-center text-xs font-light leading-relaxed text-neutral-400">
        Protected by industry-standard encryption.
        <br />
        We never share your data with third parties.
      </p>
    </AuthSplitLayout>
  );
}
