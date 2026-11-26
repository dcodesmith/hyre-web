import { Form, useNavigation } from "react-router";
import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import type { OnboardingActionData } from "./onboarding-form-schema";

type ReviewRow = {
  readonly label: string;
  readonly value: string;
};

function retryKey(actionData: OnboardingActionData | undefined, fallback: string) {
  return actionData?.intent === "submit-account" && actionData.idempotencyKey
    ? actionData.idempotencyKey
    : fallback;
}

function driverLicenseStatusLabel(status: FleetOwnerOnboarding["documents"]["driversLicense"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Replacement required";
  return "Submitted";
}

function ReviewSection({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly ReviewRow[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="divide-y divide-border rounded-sm border border-border bg-background">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 p-4 text-sm">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-right font-medium break-words text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function OnboardingSubmitForm({
  actionData,
  idempotencyKey,
  onboarding,
}: {
  readonly actionData?: OnboardingActionData;
  readonly idempotencyKey: string;
  readonly onboarding: FleetOwnerOnboarding;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "submit-account";

  const identityRows: ReviewRow[] = [
    {
      label: "Account type",
      value: onboarding.accountType === "BUSINESS" ? "Business" : "Individual",
    },
    ...(onboarding.identity?.businessName
      ? [{ label: "Business name", value: onboarding.identity.businessName }]
      : []),
    {
      label: "Legal name",
      value: onboarding.identity?.legalName ?? "Verified",
    },
  ];

  const payoutRows: ReviewRow[] = [
    { label: "Bank name", value: onboarding.bank?.bankName ?? "Verified" },
    { label: "Account number", value: onboarding.bank?.accountNumber ?? "Verified" },
    { label: "Account name", value: onboarding.bank?.accountName ?? "Verified" },
  ];

  const drivingRows: ReviewRow[] = [
    {
      label: "Driving the car yourself",
      value: onboarding.isOwnerDriver ? "Yes" : "No",
    },
    ...(onboarding.isOwnerDriver
      ? [
          {
            label: "Driver's licence",
            value: driverLicenseStatusLabel(onboarding.documents.driversLicense),
          },
        ]
      : []),
  ];

  return (
    <Form method="post" className="flex flex-col gap-14">
      <div className="flex flex-col gap-5">
        <Separator />
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-semibold leading-7 text-foreground">Review and submit</h2>
            <p className="text-sm leading-5 text-muted-foreground">
              Confirm your details before submitting for review
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <ReviewSection
              title="Phone number"
              rows={[{ label: "Phone", value: onboarding.phone.number ?? "Verified" }]}
            />
            <ReviewSection title="Identity" rows={identityRows} />
            <ReviewSection title="Payout account" rows={payoutRows} />
            <ReviewSection title="Driving credentials" rows={drivingRows} />
          </div>
        </div>

        <input type="hidden" name="intent" value="submit-account" />
        <input type="hidden" name="idempotencyKey" value={retryKey(actionData, idempotencyKey)} />
        {actionData?.intent === "submit-account" && actionData.error ? (
          <FormError id="submit-account-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        {pending ? "Submitting…" : "Submit details"}
      </Button>
    </Form>
  );
}
