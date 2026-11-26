import { type FieldMetadata, getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  type OnboardingActionData,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "./onboarding-form-schema";

function PhoneNumberControl({
  field,
  phoneNumber,
}: {
  readonly field: FieldMetadata<string>;
  readonly phoneNumber?: string;
}) {
  if (phoneNumber) {
    return <input type="hidden" name="phoneNumber" value={phoneNumber} />;
  }

  return (
    <Field data-invalid={Boolean(field.errors)}>
      <FieldLabel htmlFor={field.id}>Phone number</FieldLabel>
      <Input
        {...getInputProps(field, { type: "tel" })}
        className="h-10 rounded-sm"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+2348012345678"
        aria-invalid={field.errors ? true : undefined}
      />
      <FieldError id={field.errorId} errors={field.errors?.map((message) => ({ message }))} />
    </Field>
  );
}

export function OnboardingPhoneForm({
  actionData,
  onHaveCode,
}: {
  readonly actionData?: OnboardingActionData;
  readonly onHaveCode?: () => void;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "send-phone";
  const [form, fields] = useForm({
    id: "fleet-owner-phone",
    lastResult: actionData?.intent === "send-phone" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingPhoneFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingPhoneFormSchema });
    },
  });

  const actionError = actionData?.intent === "send-phone" ? actionData.error : undefined;
  const phoneErrors = [...(fields.phoneNumber.errors ?? []), ...(actionError ? [actionError] : [])];
  const hasPhoneError = phoneErrors.length > 0;

  return (
    <Form method="post" {...getFormProps(form)} className="flex flex-col gap-14">
      <div className="flex flex-col gap-5">
        <Separator />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold leading-7 text-foreground">
            Verify your phone number
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            We&apos;ll send you a code to verify this number is yours
          </p>
        </div>

        <input type="hidden" name="intent" value="send-phone" />
        <Field data-invalid={hasPhoneError}>
          <FieldLabel htmlFor={fields.phoneNumber.id}>Phone number</FieldLabel>
          <Input
            {...getInputProps(fields.phoneNumber, { type: "tel" })}
            className="h-10 rounded-sm"
            placeholder="+2348012345678"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={hasPhoneError || undefined}
          />
          {hasPhoneError ? (
            <FieldError id={fields.phoneNumber.errorId} errors={phoneErrors} className="text-xs" />
          ) : (
            <FieldDescription className="text-xs">
              Phone number must begin in country code format e.g +2348012345678
            </FieldDescription>
          )}
        </Field>
        <FormError id={form.errorId} errors={form.errors} />
      </div>

      <div className="flex flex-col gap-4">
        <Button
          type="submit"
          disabled={pending}
          aria-live="polite"
          className="h-12 w-full rounded-md"
        >
          {pending ? "Sending code…" : "Send verification code"}
        </Button>
        {onHaveCode ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onHaveCode}
            className="h-12 w-full rounded-md"
          >
            I already have a code
          </Button>
        ) : null}
      </div>
    </Form>
  );
}

export function OnboardingPhoneCodeForm({
  actionData,
  phoneNumber,
}: {
  readonly actionData?: OnboardingActionData;
  readonly phoneNumber?: string;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "check-phone";
  const resending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "send-phone";
  const [form, fields] = useForm({
    id: "fleet-owner-phone-code",
    lastResult: actionData?.intent === "check-phone" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingPhoneCheckFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingPhoneCheckFormSchema });
    },
  });

  const checkError = actionData?.intent === "check-phone" ? actionData.error : undefined;
  const codeErrors = [...(fields.code.errors ?? []), ...(checkError ? [checkError] : [])];
  const hasCodeError = codeErrors.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Form method="post" {...getFormProps(form)} className="flex flex-col gap-14">
        <div className="flex flex-col gap-5">
          <Separator />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-semibold leading-7 text-foreground">
              Enter verification code
            </h2>
            <p className="text-sm leading-5 text-muted-foreground">
              {actionData?.notice ??
                "We just sent a code to your phone number, enter code to continue"}
            </p>
          </div>

          <input type="hidden" name="intent" value="check-phone" />
          <PhoneNumberControl field={fields.phoneNumber} phoneNumber={phoneNumber} />
          <Field data-invalid={hasCodeError}>
            <FieldLabel htmlFor={fields.code.id}>Verification code</FieldLabel>
            <Input
              {...getInputProps(fields.code, { type: "text" })}
              className="h-10 rounded-sm"
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              spellCheck={false}
              aria-invalid={hasCodeError || undefined}
            />
            <FieldError id={fields.code.errorId} errors={codeErrors} className="text-xs" />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          {actionData?.intent === "send-phone" && actionData.error ? (
            <FormError id="resend-phone-error" errors={[actionData.error]} />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Button
            type="submit"
            disabled={pending || resending}
            aria-live="polite"
            className="h-12 w-full rounded-md"
          >
            {pending ? "Verifying…" : "Verify phone"}
          </Button>
          {phoneNumber ? (
            <Button
              type="submit"
              form="fleet-owner-phone-resend"
              variant="ghost"
              disabled={pending || resending}
              aria-live="polite"
              className="h-12 w-full rounded-md"
            >
              {resending ? "Resending…" : "Resend code"}
            </Button>
          ) : null}
        </div>
      </Form>
      {phoneNumber ? (
        <Form id="fleet-owner-phone-resend" method="post" hidden>
          <input type="hidden" name="intent" value="send-phone" />
          <input type="hidden" name="phoneNumber" value={phoneNumber} />
        </Form>
      ) : null}
    </div>
  );
}
