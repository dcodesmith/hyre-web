import { Building2Icon, CheckCircle2Icon, Clock3Icon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { Form, useOutletContext } from "react-router";

import type { FleetOwnerBank } from "~/api/fleet/onboarding/schema";
import { StatusBadge } from "~/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { FleetOwnerOutletContext } from "~/routes/fleet-owner";
import { OnboardingAccountForm } from "./onboarding-account-form";
import { OnboardingDriverLicenseForm } from "./onboarding-driver-license-form";
import type { OnboardingActionData } from "./onboarding-form-schema";
import { OnboardingPhoneCodeForm, OnboardingPhoneForm } from "./onboarding-phone-forms";

type PageProps = {
  readonly actionData?: OnboardingActionData;
  readonly banks: FleetOwnerBank[];
  readonly idempotencyKey: string;
};

function PageHeader() {
  return (
    <header className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold tracking-wide text-primary">TRIPDLY FLEET</p>
        <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Verify Your Account
        </h1>
      </div>
      <Form method="post" action="/fleet-owner/logout">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </Form>
    </header>
  );
}

function UnderReview({ context }: { readonly context: FleetOwnerOutletContext }) {
  const { onboarding } = context;
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock3Icon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>
          <h2>Verification Under Review</h2>
        </CardTitle>
        <CardDescription>
          Your details were received. You can return here to see the latest status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Identity</p>
            <p className="mt-1 font-medium">{onboarding.identity?.legalName ?? "Submitted"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bank account</p>
            <p className="mt-1 font-medium">{onboarding.bank?.accountName ?? "Submitted"}</p>
          </div>
        </div>
        <StatusBadge tone="warning">Review in progress</StatusBadge>
      </CardContent>
    </Card>
  );
}

function OnboardingStep({
  actionData,
  banks,
  context,
  idempotencyKey,
}: PageProps & { readonly context: FleetOwnerOutletContext }) {
  const { onboarding } = context;
  const [enteringExistingCode, setEnteringExistingCode] = useState(false);
  if (!onboarding.emailVerified) {
    return (
      <Alert role="note">
        <Building2Icon aria-hidden="true" />
        <AlertTitle>Verify your email first</AlertTitle>
        <AlertDescription>
          Finish email verification, then reload this page to continue.
        </AlertDescription>
      </Alert>
    );
  }
  if (onboarding.status === "UNDER_REVIEW") {
    return <UnderReview context={context} />;
  }
  if (!onboarding.phone.verified) {
    if (actionData?.phoneNumber || enteringExistingCode) {
      return (
        <OnboardingPhoneCodeForm actionData={actionData} phoneNumber={actionData?.phoneNumber} />
      );
    }
    return (
      <OnboardingPhoneForm
        actionData={actionData}
        onHaveCode={() => setEnteringExistingCode(true)}
      />
    );
  }
  if (onboarding.requiredActions.includes("UPLOAD_DRIVERS_LICENSE")) {
    return <OnboardingDriverLicenseForm actionData={actionData} />;
  }

  return (
    <>
      <Alert role="note">
        <CheckCircle2Icon aria-hidden="true" />
        <AlertTitle>Phone verified</AlertTitle>
        <AlertDescription>{onboarding.phone.number}</AlertDescription>
      </Alert>
      <OnboardingAccountForm
        actionData={actionData}
        banks={banks}
        idempotencyKey={idempotencyKey}
      />
    </>
  );
}

export function FleetOwnerOnboardingPage({ actionData, banks, idempotencyKey }: PageProps) {
  const context = useOutletContext<FleetOwnerOutletContext>();
  return (
    <>
      <PageHeader />
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Alert role="note">
          <ShieldCheckIcon aria-hidden="true" />
          <AlertTitle>Why we verify</AlertTitle>
          <AlertDescription>
            Verification protects drivers, riders, and payouts. Your details are sent securely to
            our verification providers.
          </AlertDescription>
        </Alert>
        <OnboardingStep
          actionData={actionData}
          banks={banks}
          context={context}
          idempotencyKey={idempotencyKey}
        />
      </div>
    </>
  );
}
