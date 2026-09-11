import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CameraIcon, ShieldCheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import { AuthCheckbox } from "~/auth/auth-form-primitives";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useImageFilePreviews } from "~/hooks/use-image-file-previews";
import {
  type ChauffeurOnboardingActionData,
  chauffeurConsentFormSchema,
  chauffeurDrivingFormSchema,
  chauffeurNinFormSchema,
  chauffeurPhoneCodeFormSchema,
} from "./chauffeur-onboarding-form-schema";

const EMPTY_SELFIE_FILES: readonly File[] = [];

export function ChauffeurConsentForm({
  actionData,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "accept-consent";
  const [form, fields] = useForm({
    id: "chauffeur-consent",
    lastResult: actionData?.intent === "accept-consent" ? actionData.submission : null,
    constraint: getZodConstraint(chauffeurConsentFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurConsentFormSchema });
    },
  });

  return (
    <Form method="post" {...getFormProps(form)} className="space-y-5">
      <input type="hidden" name="intent" value="accept-consent" />
      <div className="space-y-4">
        <label htmlFor={fields.termsAccepted.id} className="flex cursor-pointer items-start gap-3">
          <AuthCheckbox
            {...getInputProps(fields.termsAccepted, { type: "checkbox", value: "on" })}
            className={fields.termsAccepted.errors ? "border-destructive" : undefined}
          />
          <span className="text-sm">
            I agree to Tripdly&apos;s{" "}
            <Link className="font-medium underline" to="/terms" target="_blank" rel="noreferrer">
              Terms of Service
            </Link>
            .
          </span>
        </label>
        <FieldError
          id={fields.termsAccepted.errorId}
          errors={fields.termsAccepted.errors?.map((message) => ({ message }))}
        />
        <label
          htmlFor={fields.privacyAccepted.id}
          className="flex cursor-pointer items-start gap-3"
        >
          <AuthCheckbox
            {...getInputProps(fields.privacyAccepted, { type: "checkbox", value: "on" })}
            className={fields.privacyAccepted.errors ? "border-destructive" : undefined}
          />
          <span className="text-sm">
            I agree to the{" "}
            <Link className="font-medium underline" to="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </Link>{" "}
            and consent to identity and driving checks.
          </span>
        </label>
        <FieldError
          id={fields.privacyAccepted.errorId}
          errors={fields.privacyAccepted.errors?.map((message) => ({ message }))}
        />
      </div>
      <FormError id={form.errorId} errors={form.errors} />
      {actionData?.intent === "accept-consent" && actionData.error ? (
        <FormError id="consent-error" errors={[actionData.error]} />
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-live="polite">
        {pending ? "Saving…" : "Agree and continue"}
      </Button>
    </Form>
  );
}

function SendPhoneCodeForm({
  actionData,
  phoneNumber,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly phoneNumber: string;
}) {
  const navigation = useNavigation();
  const sending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "send-phone";

  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="intent" value="send-phone" />
      <p className="text-sm text-muted-foreground">
        We will send a one-time code to <strong className="text-foreground">{phoneNumber}</strong>.
      </p>
      {actionData?.intent === "send-phone" && actionData.error ? (
        <FormError id="send-phone-error" errors={[actionData.error]} />
      ) : null}
      <Button type="submit" className="w-full" disabled={sending} aria-live="polite">
        {sending ? "Sending code…" : "Send verification code"}
      </Button>
    </Form>
  );
}

function PhoneCodeForm({
  actionData,
  phoneNumber,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly phoneNumber: string;
}) {
  const navigation = useNavigation();
  const sending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "send-phone";
  const checking =
    navigation.formMethod != null && navigation.formData?.get("intent") === "check-phone";
  const [form, fields] = useForm({
    id: "chauffeur-phone-code",
    lastResult: actionData?.intent === "check-phone" ? actionData.submission : null,
    constraint: getZodConstraint(chauffeurPhoneCodeFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurPhoneCodeFormSchema });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {actionData?.notice ?? `Enter the code sent to ${phoneNumber}.`}
      </p>
      <Form method="post" {...getFormProps(form)} className="space-y-5">
        <input type="hidden" name="intent" value="check-phone" />
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
        <Button type="submit" className="w-full" disabled={checking || sending} aria-live="polite">
          {checking ? "Verifying…" : "Verify phone"}
        </Button>
      </Form>
      <Form method="post">
        <input type="hidden" name="intent" value="send-phone" />
        <Button
          type="submit"
          variant="ghost"
          className="w-full"
          disabled={checking || sending}
          aria-live="polite"
        >
          {sending ? "Resending…" : "Resend code"}
        </Button>
      </Form>
    </div>
  );
}

export function ChauffeurPhoneForm({
  actionData,
  phoneNumber,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly phoneNumber: string;
}) {
  const showCode =
    actionData?.intent === "check-phone" ||
    (actionData?.intent === "send-phone" && !actionData.error);

  return showCode ? (
    <PhoneCodeForm actionData={actionData} phoneNumber={phoneNumber} />
  ) : (
    <SendPhoneCodeForm actionData={actionData} phoneNumber={phoneNumber} />
  );
}

export function ChauffeurNinForm({
  actionData,
  idempotencyKey,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly idempotencyKey: string;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-nin";
  const [form, fields] = useForm({
    id: "chauffeur-nin",
    lastResult: actionData?.intent === "verify-nin" ? actionData.submission : null,
    constraint: getZodConstraint(chauffeurNinFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurNinFormSchema });
    },
  });

  return (
    <Form method="post" {...getFormProps(form)} className="space-y-5">
      <input type="hidden" name="intent" value="verify-nin" />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field data-invalid={Boolean(fields.nin.errors)}>
        <FieldLabel htmlFor={fields.nin.id}>National Identification Number (NIN)</FieldLabel>
        <Input
          {...getInputProps(fields.nin, { type: "text" })}
          className="h-10 rounded-sm"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          spellCheck={false}
          aria-invalid={fields.nin.errors ? true : undefined}
        />
        <FieldDescription>
          Your 11-digit NIN is verified securely and is not shown to the fleet owner.
        </FieldDescription>
        <FieldError
          id={fields.nin.errorId}
          errors={fields.nin.errors?.map((message) => ({ message }))}
        />
      </Field>
      <FormError id={form.errorId} errors={form.errors} />
      {actionData?.intent === "verify-nin" && actionData.error ? (
        <FormError id="nin-error" errors={[actionData.error]} />
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-live="polite">
        {pending ? "Verifying identity…" : "Verify NIN"}
      </Button>
    </Form>
  );
}

export function ChauffeurDrivingForm({
  actionData,
  idempotencyKey,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly idempotencyKey: string;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-driving";
  const [selfie, setSelfie] = useState<File>();
  const selfieFiles = useMemo(() => (selfie ? [selfie] : EMPTY_SELFIE_FILES), [selfie]);
  const [preview] = useImageFilePreviews(selfieFiles);
  const [form, fields] = useForm({
    id: "chauffeur-driving",
    lastResult: actionData?.intent === "verify-driving" ? actionData.submission : null,
    constraint: getZodConstraint(chauffeurDrivingFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurDrivingFormSchema });
    },
  });

  return (
    <Form method="post" encType="multipart/form-data" {...getFormProps(form)} className="space-y-5">
      <input type="hidden" name="intent" value="verify-driving" />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field data-invalid={Boolean(fields.driversLicenseNumber.errors)}>
        <FieldLabel htmlFor={fields.driversLicenseNumber.id}>
          Driver&apos;s licence number
        </FieldLabel>
        <Input
          {...getInputProps(fields.driversLicenseNumber, { type: "text" })}
          className="h-10 rounded-sm"
          autoComplete="off"
          maxLength={30}
          spellCheck={false}
          aria-invalid={fields.driversLicenseNumber.errors ? true : undefined}
        />
        <FieldError
          id={fields.driversLicenseNumber.errorId}
          errors={fields.driversLicenseNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.selfie.errors)}>
        <FieldLabel htmlFor={fields.selfie.id}>Passport photograph or selfie</FieldLabel>
        <Input
          {...getInputProps(fields.selfie, { type: "file" })}
          className="h-10 rounded-sm"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          aria-invalid={fields.selfie.errors ? true : undefined}
          onChange={(event) => setSelfie(event.currentTarget.files?.[0])}
        />
        <FieldDescription>
          Take a clear, front-facing photo in good light. JPEG, PNG, or WebP; maximum 5 MB.
        </FieldDescription>
        <FieldError
          id={fields.selfie.errorId}
          errors={fields.selfie.errors?.map((message) => ({ message }))}
        />
      </Field>
      {preview ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <img
            src={preview.url}
            alt="Selected selfie preview"
            width={80}
            height={80}
            className="size-20 rounded-md object-cover"
          />
          <span className="text-sm text-muted-foreground">Photo ready to verify</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <CameraIcon className="size-5" aria-hidden="true" />
          Your photo stays private and is used only for identity verification.
        </div>
      )}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Your licence, liveness, and identity are checked before your chauffeur account is approved.
      </div>
      <FormError id={form.errorId} errors={form.errors} />
      {actionData?.intent === "verify-driving" && actionData.error ? (
        <FormError id="driving-error" errors={[actionData.error]} />
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-live="polite">
        {pending ? "Completing verification…" : "Complete verification"}
      </Button>
    </Form>
  );
}
