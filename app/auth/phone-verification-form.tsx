// biome-ignore-all lint/a11y/noAutofocus: The OTP step is opened by the user and should receive focus.
import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { cn } from "cn";
import { Form, Link, useLocation, useNavigation } from "react-router";
import { AuthSubmitButton } from "~/auth/auth-form-primitives";
import {
  phoneVerificationCheckSchema,
  phoneVerificationSendSchema,
} from "~/auth/phone-verification-schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";

export type PhoneVerificationActionData = {
  readonly intent: "send-phone" | "check-phone";
  readonly maskedPhoneNumber?: string;
  readonly notice?: string;
  readonly phoneNumber?: string;
  readonly submission?: SubmissionResult<string[]>;
};

const inputClassName =
  "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

function PhoneNumberForm({
  actionData,
  initialPhoneNumber,
}: {
  readonly actionData?: PhoneVerificationActionData;
  readonly initialPhoneNumber?: string;
}) {
  const navigation = useNavigation();
  const pending = navigation.formData?.get("intent") === "send-phone";
  const [form, fields] = useForm({
    id: "verify-phone-number",
    lastResult: actionData?.intent === "send-phone" ? actionData.submission : null,
    constraint: getZodConstraint(phoneVerificationSendSchema),
    defaultValue: { phoneNumber: actionData?.phoneNumber ?? initialPhoneNumber ?? "" },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: phoneVerificationSendSchema });
    },
  });

  return (
    <Form method="post" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="intent" value="send-phone" />
      <div>
        <label htmlFor={fields.phoneNumber.id} className="mb-1.5 block text-sm font-medium">
          Phone number
        </label>
        <input
          {...getInputProps(fields.phoneNumber, { type: "tel" })}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+2348012345678"
          aria-invalid={fields.phoneNumber.errors ? true : undefined}
          className={cn(inputClassName, fields.phoneNumber.errors && "border-red-500")}
        />
        <p className="mt-1 text-sm text-neutral-600">
          Use international format, including the country code.
        </p>
        <FormError id={fields.phoneNumber.errorId} errors={fields.phoneNumber.errors} />
      </div>
      <FormError id={form.errorId} errors={form.errors} />
      <AuthSubmitButton
        pending={pending}
        pendingLabel="Sending code…"
        ariaLabel={pending ? "Sending phone verification code" : "Send phone verification code"}
      >
        Send verification code
      </AuthSubmitButton>
    </Form>
  );
}

function PhoneCodeForm({ actionData }: { readonly actionData: PhoneVerificationActionData }) {
  const location = useLocation();
  const navigation = useNavigation();
  const phoneNumber = actionData.phoneNumber ?? "";
  const checking = navigation.formData?.get("intent") === "check-phone";
  const resending = navigation.formData?.get("intent") === "send-phone";
  const [form, fields] = useForm({
    id: "verify-phone-code",
    lastResult: actionData.submission ?? null,
    constraint: getZodConstraint(phoneVerificationCheckSchema),
    defaultValue: { phoneNumber },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: phoneVerificationCheckSchema });
    },
  });

  return (
    <>
      <p className="mb-4 text-sm text-neutral-600" aria-live="polite">
        {actionData.notice ??
          `Enter the code sent to ${actionData.maskedPhoneNumber ?? "your phone"}.`}
      </p>
      <Form method="post" {...getFormProps(form)} className="space-y-4">
        <input type="hidden" name="intent" value="check-phone" />
        <input type="hidden" name="phoneNumber" value={phoneNumber} />
        <input type="hidden" name="maskedPhoneNumber" value={actionData.maskedPhoneNumber ?? ""} />
        <div>
          <label htmlFor={fields.code.id} className="mb-1.5 block text-sm font-medium">
            Verification code
          </label>
          <input
            {...getInputProps(fields.code, { type: "text" })}
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            spellCheck={false}
            placeholder="4 to 10 digit code"
            aria-invalid={fields.code.errors ? true : undefined}
            className={cn(
              inputClassName,
              "tracking-[0.3em]",
              fields.code.errors && "border-red-500",
            )}
          />
          <FormError id={fields.code.errorId} errors={fields.code.errors} />
        </div>
        <FormError id={form.errorId} errors={form.errors} />
        <AuthSubmitButton
          pending={checking}
          pendingLabel="Verifying…"
          ariaLabel={checking ? "Verifying phone" : "Verify phone"}
        >
          Verify phone
        </AuthSubmitButton>
      </Form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Form method="post">
          <input type="hidden" name="intent" value="send-phone" />
          <input type="hidden" name="phoneNumber" value={phoneNumber} />
          <input
            type="hidden"
            name="maskedPhoneNumber"
            value={actionData.maskedPhoneNumber ?? ""}
          />
          <Button
            type="submit"
            variant="ghost"
            disabled={checking || resending}
            className="h-auto px-1 py-0 text-sm font-medium text-neutral-900 hover:bg-transparent hover:underline"
          >
            {resending ? "Resending…" : "Resend code"}
          </Button>
        </Form>
        <Link
          to={`${location.pathname}${location.search}`}
          replace
          className="px-1 text-sm font-medium text-neutral-900 underline"
        >
          Edit number
        </Link>
      </div>
    </>
  );
}

export function PhoneVerificationForm({
  actionData,
  initialPhoneNumber,
  changingPhone,
}: {
  readonly actionData?: PhoneVerificationActionData;
  readonly initialPhoneNumber?: string;
  readonly changingPhone: boolean;
}) {
  const showCode = actionData?.phoneNumber != null && actionData.maskedPhoneNumber != null;

  return (
    <>
      <h1 className="text-balance text-2xl font-semibold tracking-tight">
        {changingPhone ? "Change your phone number" : "Verify your phone"}
      </h1>
      <p className="mt-2 mb-5 text-sm leading-6 text-neutral-600">
        Used for booking updates, trip coordination and secure WhatsApp booking. Your number is
        never shared with fleet owners or chauffeurs.
      </p>

      {showCode && actionData ? (
        <PhoneCodeForm actionData={actionData} />
      ) : (
        <PhoneNumberForm actionData={actionData} initialPhoneNumber={initialPhoneNumber} />
      )}

      <Form method="post" action="/logout" className="mt-6">
        <Button type="submit" variant="link" className="h-auto px-0 text-sm text-neutral-600">
          Sign out
        </Button>
      </Form>
    </>
  );
}
