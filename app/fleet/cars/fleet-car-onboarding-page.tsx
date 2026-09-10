import { ArrowLeftIcon, CarIcon, TriangleAlertIcon } from "lucide-react";
import { Link } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { FleetCarOnboardingActionData } from "./car-onboarding-form-schema";
import { type FleetCarOnboardingStep, getFleetCarOnboardingStep } from "./fleet-car";
import { CarDocumentStep, CarImageStep } from "./fleet-car-onboarding-assets";
import { CarPricingStep } from "./fleet-car-onboarding-pricing";
import { CarSubmissionStep } from "./fleet-car-onboarding-submission";

type PageProps = {
  readonly actionData?: FleetCarOnboardingActionData;
  readonly car: FleetCar;
  readonly idempotencyKey: string;
};

const stepDetails = {
  documents: { number: 2, label: "Documents" },
  photos: { number: 3, label: "Photos" },
  pricing: { number: 4, label: "Pricing" },
  submit: { number: 5, label: "Submit" },
} satisfies Record<FleetCarOnboardingStep, { number: number; label: string }>;

export function FleetCarOnboardingPage({ actionData, car, idempotencyKey }: PageProps) {
  const step = getFleetCarOnboardingStep(car);
  const currentStep = stepDetails[step];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/fleet-owner/cars">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back to cars
          </Link>
        </Button>
        <p className="mb-1 text-sm font-medium text-primary" role="status" aria-live="polite">
          Step {currentStep.number} of 5 · {currentStep.label}
        </p>
        <h2 className="wrap-break-word text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Set Up {car.make} {car.model}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete this step to continue setting up your car.
        </p>
      </div>

      {actionData?.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>Unable to complete this step</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CarIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle>
              <h3>Verified Vehicle</h3>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Plate</dt>
              <dd className="mt-1 font-medium">{car.registrationNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Year</dt>
              <dd className="mt-1 font-medium">{car.year}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Color</dt>
              <dd className="mt-1 font-medium">{car.color || "Not specified"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Seats</dt>
              <dd className="mt-1 font-medium">{car.passengerCapacity}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {step === "documents" ? <CarDocumentStep actionData={actionData} /> : null}
      {step === "photos" ? <CarImageStep actionData={actionData} /> : null}
      {step === "pricing" ? <CarPricingStep actionData={actionData} car={car} /> : null}
      {step === "submit" ? (
        <CarSubmissionStep actionData={actionData} car={car} idempotencyKey={idempotencyKey} />
      ) : null}
    </div>
  );
}
