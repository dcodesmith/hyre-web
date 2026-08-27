import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useNavigation } from "react-router";
import type { z } from "zod";

import type { AuthRole } from "~/api/auth/schema";
import { AuthCheckbox, AuthSubmitButton } from "~/auth/auth-form-primitives";
import { loginFormSchema, roleLoginFormSchema } from "~/auth/auth-form-schema";
import { FormError } from "~/components/forms/form-primitives";
import { cn } from "~/lib/utils";

type LoginFormProps = {
  readonly actionData?: SubmissionResult<string[]>;
  readonly authRole: AuthRole;
  readonly heading: string;
  readonly id: string;
  readonly referralCode?: string;
};

type LoginFormValue = z.infer<typeof loginFormSchema>;

export function LoginForm({ actionData, authRole, heading, id, referralCode }: LoginFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.formMethod != null;
  const showReferral = authRole === "user";
  const schema = showReferral ? loginFormSchema : roleLoginFormSchema;
  const [form, fields] = useForm<LoginFormValue, LoginFormValue, string[]>({
    id,
    lastResult: actionData,
    constraint: getZodConstraint(schema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      referralCode,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const { email, referralCode: referralCodeField, acceptTerms } = fields;

  return (
    <>
      <h1 className="sr-only">{heading}</h1>

      <Form method="post" {...getFormProps(form)}>
        <div className="flex flex-col gap-4">
          <div>
            <input
              {...getInputProps(email, { type: "email" })}
              autoComplete="email"
              spellCheck={false}
              placeholder="Email address…"
              aria-label="Email"
              className={cn(
                "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                email.errors && "border-red-500",
              )}
            />
            <FormError id={email.errorId} errors={email.errors} />
          </div>

          {showReferral ? (
            <div>
              <input
                {...getInputProps(referralCodeField, { type: "text" })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Referral code (optional)…"
                aria-label="Referral code (optional)"
                className={cn(
                  "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                  referralCodeField.errors && "border-red-500",
                )}
              />
              <FormError id={referralCodeField.errorId} errors={referralCodeField.errors} />
            </div>
          ) : null}

          <div>
            <label
              htmlFor={acceptTerms.id}
              className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-600"
            >
              <AuthCheckbox
                {...getInputProps(acceptTerms, { type: "checkbox", value: "on" })}
                aria-label="I agree to Tripdly's Terms of Service and Privacy Policy"
                className={acceptTerms.errors ? "border-red-500" : undefined}
              />
              <span>
                I agree to Tripdly&apos;s{" "}
                <Link to="/terms" className="underline" target="_blank" rel="noopener noreferrer">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
              </span>
            </label>
            <FormError id={acceptTerms.errorId} errors={acceptTerms.errors} />
          </div>

          <FormError id={form.errorId} errors={form.errors} />

          <AuthSubmitButton
            pending={isSubmitting}
            pendingLabel="Sending code…"
            ariaLabel={isSubmitting ? "Sending verification code" : "Send verification code"}
          >
            Send verification code
          </AuthSubmitButton>
        </div>
      </Form>
    </>
  );
}
