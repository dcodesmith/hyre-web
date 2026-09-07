import { ArrowLeftIcon, CarIcon, TriangleAlertIcon } from "lucide-react";
import { Link } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { FleetCarOnboardingActionData } from "./car-onboarding-form-schema";
import { CarDocumentStep, CarImageStep } from "./fleet-car-onboarding-assets";
import { CarInsuranceStep, CarSubmissionStep } from "./fleet-car-onboarding-insurance";
import { CarPricingStep } from "./fleet-car-onboarding-pricing";

type PageProps = {
  readonly actionData?: FleetCarOnboardingActionData;
  readonly car: FleetCar;
  readonly idempotencyKey: string;
};

export function FleetCarOnboardingPage({ actionData, car, idempotencyKey }: PageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/fleet-owner/cars">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to cars
          </Link>
        </Button>
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Set Up {car.make} {car.model}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete each section, then submit the car for review.
        </p>
      </div>

      {actionData?.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>Unable to complete this step</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CarIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle>
              <h3>Verified Vehicle</h3>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <CarDocumentStep car={car} />
        <CarImageStep car={car} />
      </div>
      <CarPricingStep car={car} />
      <CarInsuranceStep car={car} idempotencyKey={idempotencyKey} />
      <CarSubmissionStep />
    </div>
  );
}
