import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { type ReactNode, useState } from "react";
import { Form, useNavigation } from "react-router";

import type { FleetOwnerBank, FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  AccountTypeFields,
  BankFields,
  BusinessFields,
  DriverDocumentFields,
  NinField,
  OwnerDriverFields,
} from "./onboarding-account-fields";
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

function drivingSummary(onboarding: FleetOwnerOnboarding) {
  if (onboarding.steps.driving === "SKIPPED") {
    return "Not required";
  }

  return onboarding.isOwnerDriver ? "Owner-driver" : "Will add a chauffeur later";
}

function StageCard({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
    <StageCard
      title="Verify Your Identity"
      description={
        accountType === "BUSINESS"
          ? "Business accounts are checked against CAC. The representative's NIN is also required."
          : undefined
      }
    >
      <Form key={form.id} method="post" {...getFormProps(form)} className="space-y-6">
        <input type="hidden" name="intent" value="verify-identity" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "verify-identity", idempotencyKey)}
        />
        <AccountTypeFields field={fields.accountType} onChange={setAccountType} />
        <div className="grid gap-5 sm:grid-cols-2">
          <NinField field={fields.nin} accountType={accountType} />
          {accountType === "BUSINESS" ? (
            <BusinessFields
              businessName={fields.businessName}
              registrationNumber={fields.registrationNumber}
              registrationType={fields.registrationType}
            />
          ) : null}
        </div>
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "verify-identity" && actionData.error ? (
          <FormError id="verify-identity-error" errors={[actionData.error]} />
        ) : null}
        <Button type="submit" disabled={pending} aria-live="polite">
          {pending ? "Verifying identity…" : "Verify Identity"}
        </Button>
      </Form>
    </StageCard>
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
    <StageCard
      title="Add Payout Details"
      description={
        onboarding.accountType === "BUSINESS"
          ? "The bank account name must match the CAC business name."
          : "The bank account name must match the verified identity."
      }
    >
      <Form method="post" {...getFormProps(form)} className="space-y-6">
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
        <Button type="submit" disabled={pending} aria-live="polite">
          {pending ? "Verifying payout…" : "Verify Payout"}
        </Button>
      </Form>
    </StageCard>
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
    <StageCard title="Driving Credentials">
      <Form
        method="post"
        encType="multipart/form-data"
        {...getFormProps(form)}
        className="space-y-6"
      >
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
          <DriverDocumentFields driversLicense={fields.driversLicense} lasdri={fields.lasdri} />
        ) : null}
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "save-driving" && actionData.error ? (
          <FormError id="save-driving-error" errors={[actionData.error]} />
        ) : null}
        <Button type="submit" disabled={pending} aria-live="polite">
          {pending ? "Saving credentials…" : "Save Credentials"}
        </Button>
      </Form>
    </StageCard>
  );
}

export function OnboardingSubmitForm({
  actionData,
  idempotencyKey,
  onboarding,
}: StageFormProps & { readonly onboarding: FleetOwnerOnboarding }) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "submit-account";

  return (
    <StageCard
      title="Review and Submit"
      description="Confirm these details, then submit for review."
    >
      <dl className="mb-6 grid gap-3 rounded-sm border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Identity</dt>
          <dd className="mt-1 wrap-break-words font-medium">
            {onboarding.identity?.legalName ?? "Verified"}
          </dd>
        </div>
        {onboarding.identity?.businessName ? (
          <div>
            <dt className="text-muted-foreground">Business</dt>
            <dd className="mt-1 wrap-break-words font-medium">
              {onboarding.identity.businessName}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Bank account</dt>
          <dd className="mt-1 wrap-break-words font-medium">
            {onboarding.bank?.accountName ?? "Verified"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Driving</dt>
          <dd className="mt-1 font-medium">{drivingSummary(onboarding)}</dd>
        </div>
      </dl>
      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="submit-account" />
        <input
          type="hidden"
          name="idempotencyKey"
          value={retryKey(actionData, "submit-account", idempotencyKey)}
        />
        {actionData?.intent === "submit-account" && actionData.error ? (
          <FormError id="submit-account-error" errors={[actionData.error]} />
        ) : null}
        <Button type="submit" disabled={pending} aria-live="polite">
          {pending ? "Submitting…" : "Submit verification"}
        </Button>
      </Form>
    </StageCard>
  );
}
