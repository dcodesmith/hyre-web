import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useNavigation } from "react-router";

import { AuthSubmitButton } from "~/auth/auth-form-primitives";
import { verifyFormSchema } from "~/auth/auth-form-schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type VerifyFormProps = {
  readonly actionData?: {
    lastResult: SubmissionResult<string[]> | null;
    notice?: string;
  };
  readonly email: string;
  readonly heading?: string;
  readonly loginHref: string;
};

export function VerifyForm({
  actionData,
  email,
  heading = "Verify email",
  loginHref,
}: VerifyFormProps) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const isFormPending = navigation.formMethod != null;
  const isVerifyPending = isFormPending && intent === "verify";
  const isResendPending = isFormPending && intent === "resend";
  const [form, fields] = useForm({
    id: "verify-otp",
    lastResult: actionData?.lastResult ?? null,
    constraint: getZodConstraint(verifyFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifyFormSchema });
    },
  });
  const { code } = fields;

  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      <p className="mb-4 break-all text-sm text-neutral-600">Code sent to {email}</p>

      <Form method="post" {...getFormProps(form)}>
        <input type="hidden" name="intent" value="verify" />
        <div className="flex flex-col gap-4">
          <div>
            <input
              {...getInputProps(code, { type: "text" })}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              spellCheck={false}
              placeholder="6-digit code…"
              aria-label="Verification code"
              className={cn(
                "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 tracking-[0.3em] placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                code.errors && "border-red-500",
              )}
            />
            <FormError id={code.errorId} errors={code.errors} />
          </div>

          <FormError id={form.errorId} errors={form.errors} />
          {actionData?.notice ? (
            <p className="text-sm text-neutral-600" aria-live="polite">
              {actionData.notice}
            </p>
          ) : null}

          <AuthSubmitButton
            pending={isVerifyPending}
            pendingLabel="Verifying…"
            ariaLabel={isVerifyPending ? "Verifying code" : "Verify email"}
          >
            Verify email
          </AuthSubmitButton>
        </div>
      </Form>

      <div className="mt-4 flex items-center gap-1 text-sm text-neutral-600">
        <span>Didn&apos;t get it?</span>
        <Form method="post">
          <input type="hidden" name="intent" value="resend" />
          <Button
            type="submit"
            variant="ghost"
            disabled={isVerifyPending || isResendPending}
            className="h-auto px-1 py-0 text-sm font-medium text-neutral-900 hover:bg-transparent hover:underline"
          >
            {isResendPending ? "Sending…" : "Resend code"}
          </Button>
        </Form>
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        Wrong email?{" "}
        <Link to={loginHref} className="font-medium text-neutral-900 underline">
          Start again
        </Link>
      </p>
    </>
  );
}
