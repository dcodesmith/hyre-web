import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { FleetOwnerBank, FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  AccountTypeFields,
  BankFields,
  BusinessFields,
  DriverDocumentFields,
  NinField,
  OwnerDriverFields,
} from "./onboarding-account-fields";
import { OnboardingSelfieCard } from "./onboarding-driving-fields";
import {
  type OnboardingActionData,
  type OnboardingDrivingFormInput,
  type OnboardingDrivingFormValue,
  type OnboardingIdentityFormInput,
  type OnboardingIdentityFormValue,
  type OnboardingPayoutFormInput,
  onboardingDrivingFormSchema,
  onboardingIdentityFormSchema,
  onboardingPayoutFormSchema,
  onboardingSelfieReplacementFormSchema,
} from "./onboarding-form-schema";

type StageFormProps = {
  readonly actionData?: OnboardingActionData;
  readonly idempotencyKey: string;
};

function retryKey(actionData: OnboardingActionData | undefined, intent: string, fallback: string) {
  return actionData?.intent === intent && actionData.idempotencyKey
    ? actionData.idempotencyKey
    : fallback;
}

function SectionHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-xl font-semibold leading-7 text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function OnboardingIdentityForm({ actionData, idempotencyKey }: StageFormProps) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-identity";
  const accountTypeDefault =
    actionData?.intent === "verify-identity" &&
    actionData.submission?.initialValue?.accountType === "BUSINESS"
      ? "BUSINESS"
      : "INDIVIDUAL";
  const [accountType, setAccountType] = useState<"INDIVIDUAL" | "BUSINESS">(accountTypeDefault);
  const [form, fields] = useForm<OnboardingIdentityFormInput, OnboardingIdentityFormValue>({
    id: `fleet-owner-identity-${accountType}`,
    lastResult:
      actionData?.intent === "verify-identity" &&
      actionData.submission?.initialValue?.accountType === accountType
        ? actionData.submission
        : null,
    constraint: getZodConstraint(onboardingIdentityFormSchema),
    defaultValue: { accountType },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingIdentityFormSchema });
    },
  });

  return (
    <Form key={form.id} method="post" {...getFormProps(form)} className="flex flex-col gap-14">
      <div className="flex flex-col gap-5">
        <Separator />
        <SectionHeading
          title="Select account type"
          description="What kind of account do you want to set up?"
        />

        <input type="hidden" name="intent" value="verify-identity" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "verify-identity", idempotencyKey)}
        />
        <AccountTypeFields field={fields.accountType} onChange={setAccountType} />
        {accountType === "BUSINESS" ? (
          <BusinessFields
            businessName={fields.businessName}
            registrationNumber={fields.registrationNumber}
            registrationType={fields.registrationType}
          />
        ) : null}
        <NinField field={fields.nin} accountType={accountType} />
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "verify-identity" && actionData.error ? (
          <FormError id="verify-identity-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        {pending ? "Verifying identity…" : "Verify Identity"}
      </Button>
    </Form>
  );
}

export function OnboardingPayoutForm({
  actionData,
  banks,
  idempotencyKey,
  onboarding,
}: StageFormProps & {
  readonly banks: FleetOwnerBank[];
  readonly onboarding: FleetOwnerOnboarding;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-payout";
  const [form, fields] = useForm<OnboardingPayoutFormInput>({
    id: "fleet-owner-payout",
    lastResult: actionData?.intent === "verify-payout" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingPayoutFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingPayoutFormSchema });
    },
  });

  return (
    <Form method="post" {...getFormProps(form)} className="flex flex-col gap-14">
      <div className="flex flex-col gap-5">
        <Separator />
        <SectionHeading
          title="Set payout account"
          description={
            onboarding.accountType === "BUSINESS"
              ? "The bank account name must match the CAC business name."
              : "The bank account name must match the verified identity."
          }
        />

        <input type="hidden" name="intent" value="verify-payout" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "verify-payout", idempotencyKey)}
        />
        <BankFields banks={banks} bankCode={fields.bankCode} accountNumber={fields.accountNumber} />
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "verify-payout" && actionData.error ? (
          <FormError id="verify-payout-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        {pending ? "Verifying payout…" : "Add Bank"}
      </Button>
    </Form>
  );
}

export function OnboardingDrivingForm({ actionData, idempotencyKey }: StageFormProps) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "save-driving";
  const [isOwnerDriver, setIsOwnerDriver] = useState(
    actionData?.intent === "save-driving" &&
      actionData.submission?.initialValue?.isOwnerDriver === "true",
  );
  const [form, fields] = useForm<OnboardingDrivingFormInput, OnboardingDrivingFormValue>({
    id: "fleet-owner-driving",
    lastResult: actionData?.intent === "save-driving" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingDrivingFormSchema),
    defaultValue: { isOwnerDriver: isOwnerDriver ? "true" : "false" },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingDrivingFormSchema });
    },
  });

  return (
    <Form
      method="post"
      encType="multipart/form-data"
      {...getFormProps(form)}
      className="flex flex-col gap-14"
    >
      <div className="flex flex-col gap-5">
        <Separator />
        <SectionHeading
          title="Driving credentials"
          description="Will you drive this car yourself?"
        />

        <input type="hidden" name="intent" value="save-driving" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "save-driving", idempotencyKey)}
        />
        <OwnerDriverFields
          field={fields.isOwnerDriver}
          isOwnerDriver={isOwnerDriver}
          onChange={setIsOwnerDriver}
        />
        {isOwnerDriver ? (
          <>
            <DriverDocumentFields
              driversLicenseNumber={fields.driversLicenseNumber}
              driversLicense={fields.driversLicense}
            />
            <Separator />
            <OnboardingSelfieCard field={fields.selfie} />
          </>
        ) : null}
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "save-driving" && actionData.error ? (
          <FormError id="save-driving-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        {pending ? "Saving credentials…" : "Save and continue"}
      </Button>
    </Form>
  );
}

export function OnboardingSelfieForm({ actionData, idempotencyKey }: StageFormProps) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "replace-selfie";
  const [form, fields] = useForm({
    id: "fleet-owner-selfie",
    lastResult: actionData?.intent === "replace-selfie" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingSelfieReplacementFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingSelfieReplacementFormSchema });
    },
  });

  return (
    <Form
      method="post"
      encType="multipart/form-data"
      {...getFormProps(form)}
      className="flex flex-col gap-14"
    >
      <div className="flex flex-col gap-5">
        <Separator />
        <SectionHeading
          title="Take a new profile photo"
          description="Staff could not approve the previous selfie. Submit a clear new one to continue."
        />

        <input type="hidden" name="intent" value="replace-selfie" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "replace-selfie", idempotencyKey)}
        />
        <OnboardingSelfieCard field={fields.selfie} />
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "replace-selfie" && actionData.error ? (
          <FormError id="replace-selfie-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        {pending ? "Submitting selfie…" : "Submit new selfie"}
      </Button>
    </Form>
  );
}
