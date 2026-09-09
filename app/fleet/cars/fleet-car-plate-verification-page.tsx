import { ArrowLeftIcon, CheckCircle2Icon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { NewFleetCarActionData } from "./car-onboarding-form-schema";

type PageProps = {
  readonly actionData?: NewFleetCarActionData;
  readonly idempotencyKey: string;
};

export function FleetCarPlateVerificationPage({ actionData, idempotencyKey }: PageProps) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const verification = actionData?.verification;
  const vehicle = verification?.vehicle;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/fleet-owner/cars">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back to cars
          </Link>
        </Button>
        <p className="mb-1 text-sm font-medium text-primary">Step 1 of 5 · Vehicle</p>
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Add a Verified Car
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the Nigerian number plate and insurance policy number to verify the vehicle.
        </p>
      </div>

      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle>
            <h3>Verify Vehicle</h3>
          </CardTitle>
          <CardDescription>
            Use the plate and policy number shown on your documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form key={idempotencyKey} method="post" className="space-y-5">
            <input type="hidden" name="intent" value="verify-plate" />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="plate-number">Number plate</FieldLabel>
                <Input
                  id="plate-number"
                  name="plateNumber"
                  className="h-10 rounded-sm"
                  placeholder="ABC 123 XY…"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <FieldDescription>Examples: ABC-123XY, ABC123XY, or AB123XY.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="policy-number">Insurance policy number</FieldLabel>
                <Input
                  id="policy-number"
                  name="policyNumber"
                  className="h-10 rounded-sm"
                  minLength={3}
                  maxLength={100}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <FieldDescription>
                  Enter the policy number from the insurance certificate.
                </FieldDescription>
              </Field>
            </div>
            {actionData?.error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>Unable to continue</AlertTitle>
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={intent === "verify-plate"}>
              <SearchIcon data-icon="inline-start" aria-hidden="true" />
              {intent === "verify-plate" ? "Verifying Vehicle…" : "Verify Vehicle"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      {verification && vehicle && verification.eligibility.isEligible ? (
        <Card className="rounded-sm" role="status" aria-live="polite">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CheckCircle2Icon className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>
              <h3>Vehicle and Insurance Verified</h3>
            </CardTitle>
            <CardDescription>
              Confirm these registry details before creating the draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 rounded-sm border p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Vehicle</dt>
                <dd className="mt-1 font-medium">
                  {vehicle.make ?? "Unknown"} {vehicle.model ?? ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Year</dt>
                <dd className="mt-1 font-medium">{vehicle.year ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plate</dt>
                <dd className="mt-1 font-medium">{vehicle.plateNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Color</dt>
                <dd className="mt-1 font-medium">{vehicle.color ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seats</dt>
                <dd className="mt-1 font-medium">{vehicle.passengerCapacity ?? "Unknown"}</dd>
              </div>
            </dl>
            {verification.eligibility.isEligible ? (
              <div className="space-y-3">
                <p className="font-medium">Are these the correct vehicle details?</p>
                <div className="flex flex-wrap gap-3">
                  <Form method="post">
                    <input type="hidden" name="intent" value="create-draft" />
                    <input type="hidden" name="verificationId" value={verification.id} />
                    <Button type="submit" disabled={intent === "create-draft"}>
                      {intent === "create-draft" ? "Creating Draft…" : "Yes, Add This Car"}
                    </Button>
                  </Form>
                  <Form method="get">
                    <Button type="submit" variant="outline">
                      No, Check Another Car
                    </Button>
                  </Form>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
