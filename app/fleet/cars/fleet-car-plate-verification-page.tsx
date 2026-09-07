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
            <ArrowLeftIcon data-icon="inline-start" />
            Back to cars
          </Link>
        </Button>
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Add a Verified Car
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with the Nigerian number plate. We will retrieve the registered vehicle details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Verify Number Plate</h3>
          </CardTitle>
          <CardDescription>Use the plate printed on the vehicle.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="verify-plate" />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <Field>
              <FieldLabel htmlFor="plate-number">Number plate</FieldLabel>
              <Input
                id="plate-number"
                name="plateNumber"
                placeholder="ABC 123 XY…"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <FieldDescription>Examples: ABC-123XY, ABC123XY, or AB123XY.</FieldDescription>
            </Field>
            {actionData?.error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>Unable to continue</AlertTitle>
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={intent === "verify-plate"}>
              <SearchIcon data-icon="inline-start" />
              {intent === "verify-plate" ? "Checking plate…" : "Check plate"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      {verification && vehicle ? (
        <Card role="status" aria-live="polite">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CheckCircle2Icon className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>
              <h3>Vehicle Found</h3>
            </CardTitle>
            <CardDescription>
              Confirm these registry details before creating the draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
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
            </dl>
            {verification.eligibility.isEligible ? (
              <Form method="post">
                <input type="hidden" name="intent" value="create-draft" />
                <input type="hidden" name="verificationId" value={verification.id} />
                <Button type="submit" disabled={intent === "create-draft"}>
                  {intent === "create-draft" ? "Creating draft…" : "Create Car Draft"}
                </Button>
              </Form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
