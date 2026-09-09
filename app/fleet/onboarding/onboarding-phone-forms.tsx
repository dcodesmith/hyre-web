import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  type OnboardingActionData,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "./onboarding-form-schema";

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

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h2>Verify Your Phone</h2>
        </CardTitle>
        <CardDescription>We will send a one-time code by SMS.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" {...getFormProps(form)} className="space-y-5">
          <input type="hidden" name="intent" value="send-phone" />
          <Field data-invalid={Boolean(fields.phoneNumber.errors)}>
            <FieldLabel htmlFor={fields.phoneNumber.id}>Phone number</FieldLabel>
            <Input
              {...getInputProps(fields.phoneNumber, { type: "tel" })}
              className="h-10 rounded-sm"
              placeholder="+234 801 234 5678…"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={fields.phoneNumber.errors ? true : undefined}
            />
            <FieldDescription>
              Use international format, including the country code.
            </FieldDescription>
            <FieldError
              id={fields.phoneNumber.errorId}
              errors={fields.phoneNumber.errors?.map((message) => ({ message }))}
            />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          {actionData?.intent === "send-phone" && actionData.error ? (
            <FormError id="send-phone-error" errors={[actionData.error]} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending} aria-live="polite">
              {pending ? "Sending code…" : "Send Verification Code"}
            </Button>
            {onHaveCode ? (
              <Button type="button" variant="ghost" onClick={onHaveCode}>
                I Already Have a Code
              </Button>
            ) : null}
          </div>
        </Form>
      </CardContent>
    </Card>
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

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h2>Enter the SMS Code</h2>
        </CardTitle>
        <CardDescription>
          {actionData?.notice ?? "Use the code sent to your phone."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" {...getFormProps(form)} className="space-y-5">
          <input type="hidden" name="intent" value="check-phone" />
          {phoneNumber ? (
            <input type="hidden" name="phoneNumber" value={phoneNumber} />
          ) : (
            <Field data-invalid={Boolean(fields.phoneNumber.errors)}>
              <FieldLabel htmlFor={fields.phoneNumber.id}>Phone number</FieldLabel>
              <Input
                {...getInputProps(fields.phoneNumber, { type: "tel" })}
                className="h-10 rounded-sm"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+234 801 234 5678…"
                aria-invalid={fields.phoneNumber.errors ? true : undefined}
              />
              <FieldError
                id={fields.phoneNumber.errorId}
                errors={fields.phoneNumber.errors?.map((message) => ({ message }))}
              />
            </Field>
          )}
          <Field data-invalid={Boolean(fields.code.errors)}>
            <FieldLabel htmlFor={fields.code.id}>Verification code</FieldLabel>
            <Input
              {...getInputProps(fields.code, { type: "text" })}
              className="h-10 rounded-sm"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              spellCheck={false}
              aria-invalid={fields.code.errors ? true : undefined}
            />
            <FieldError
              id={fields.code.errorId}
              errors={fields.code.errors?.map((message) => ({ message }))}
            />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          {actionData?.intent === "check-phone" && actionData.error ? (
            <FormError id="check-phone-error" errors={[actionData.error]} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || resending} aria-live="polite">
              {pending ? "Verifying…" : "Verify Phone"}
            </Button>
            {phoneNumber ? (
              <Button
                type="submit"
                form="fleet-owner-phone-resend"
                variant="ghost"
                disabled={pending || resending}
                aria-live="polite"
              >
                {resending ? "Resending…" : "Resend Code"}
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
        {actionData?.intent === "send-phone" && actionData.error ? (
          <FormError id="resend-phone-error" errors={[actionData.error]} />
        ) : null}
      </CardContent>
    </Card>
  );
}
