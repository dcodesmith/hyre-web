import { CheckIcon, CircleIcon, Clock3Icon, ShieldCheckIcon } from "lucide-react";

import type { ChauffeurOnboarding } from "~/api/chauffeurs/schema";
import { CookieConsentBanner } from "~/components/cookie-consent-banner";
import { BrandLink } from "~/components/layout/brand-link";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { ChauffeurOnboardingActionData } from "./chauffeur-onboarding-form-schema";
import {
  ChauffeurConsentForm,
  ChauffeurDrivingForm,
  ChauffeurNinForm,
  ChauffeurPhoneForm,
} from "./chauffeur-onboarding-forms";

const stages = [
  { key: "consent", label: "Consent" },
  { key: "phone", label: "Phone" },
  { key: "nin", label: "Identity" },
  { key: "driving", label: "Driving" },
] as const;

type ChauffeurOnboardingPageProps = {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly idempotencyKey: string;
  readonly onboarding: ChauffeurOnboarding | null;
};

function VerificationProgress({ onboarding }: { readonly onboarding: ChauffeurOnboarding }) {
  const currentIndex = stages.findIndex(({ key }) => !onboarding.steps[key]);

  return (
    <ol aria-label="Verification progress" className="grid grid-cols-4 gap-2">
      {stages.map((stage, index) => {
        const complete = onboarding.steps[stage.key];
        const current = index === currentIndex;

        return (
          <li
            key={stage.key}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1.5 border-t-2 pt-2 text-center text-xs",
              complete || current
                ? "border-primary text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                complete
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "border border-primary"
                    : "border border-border",
              )}
            >
              {complete ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <CircleIcon className="size-2 fill-current" aria-hidden="true" />
              )}
            </span>
            <span className="truncate">{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CurrentStage({
  actionData,
  idempotencyKey,
  onboarding,
}: {
  readonly actionData?: ChauffeurOnboardingActionData;
  readonly idempotencyKey: string;
  readonly onboarding: ChauffeurOnboarding;
}) {
  if (!onboarding.steps.consent) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Before you begin</h2>
          </CardTitle>
          <CardDescription>
            Review how Tripdly will verify your identity and driving credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurConsentForm actionData={actionData} />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.phone) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your phone</h2>
          </CardTitle>
          <CardDescription>
            Confirm the number your fleet owner provided for booking communications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurPhoneForm actionData={actionData} phoneNumber={onboarding.phoneNumber} />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.nin) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your identity</h2>
          </CardTitle>
          <CardDescription>
            We use your NIN to confirm your legal identity. It is never shared with the fleet owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurNinForm
            actionData={actionData}
            idempotencyKey={actionData?.idempotencyKey ?? idempotencyKey}
          />
        </CardContent>
      </>
    );
  }

  if (!onboarding.steps.driving) {
    return (
      <>
        <CardHeader>
          <CardTitle>
            <h2>Verify your driving credentials</h2>
          </CardTitle>
          <CardDescription>
            Provide your driver&apos;s licence number and a current photo to finish verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurDrivingForm
            actionData={actionData}
            idempotencyKey={actionData?.idempotencyKey ?? idempotencyKey}
          />
        </CardContent>
      </>
    );
  }

  return (
    <CardContent className="py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <ShieldCheckIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Verification complete</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        You are approved to drive for {onboarding.fleetOwnerName ?? "your fleet owner"}. They can
        now assign bookings to you.
      </p>
    </CardContent>
  );
}

function UnavailableInvitation() {
  return (
    <Card className="w-full max-w-lg rounded-sm">
      <CardContent className="py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Clock3Icon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">This invitation is unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may have expired or already been used. Ask your fleet owner to send a new
          invitation.
        </p>
      </CardContent>
    </Card>
  );
}

export function ChauffeurOnboardingPage({
  actionData,
  idempotencyKey,
  onboarding,
}: ChauffeurOnboardingPageProps) {
  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-60 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:ring-2 focus:ring-ring motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
            <BrandLink />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex max-w-5xl justify-center px-4 py-8 sm:px-6 sm:py-12"
        >
          {onboarding ? (
            <div className="w-full max-w-xl space-y-5">
              <div>
                <p className="text-sm font-medium text-primary">
                  Invited by {onboarding.fleetOwnerName ?? "your fleet owner"}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Welcome, {onboarding.name}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete these checks so you can receive Tripdly bookings.
                </p>
              </div>
              <VerificationProgress onboarding={onboarding} />
              {actionData?.error && !actionData.submission ? (
                <Alert variant="destructive">
                  <AlertTitle>We could not complete that step</AlertTitle>
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              ) : null}
              <Card className="rounded-sm">
                <CurrentStage
                  actionData={actionData}
                  idempotencyKey={idempotencyKey}
                  onboarding={onboarding}
                />
              </Card>
            </div>
          ) : (
            <UnavailableInvitation />
          )}
        </main>
      </div>
      <CookieConsentBanner />
    </>
  );
}
