import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Form, Link, useNavigation } from "react-router";
import type { FleetVehicleVerification } from "~/api/fleet/cars/onboarding-schema";
import { FormError } from "~/components/forms/form-primitives";
import { QuestionnaireProgress } from "~/components/questionnaire-progress";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  carOnboardingPlateFormSchema,
  type NewFleetCarActionData,
} from "./car-onboarding-form-schema";
import { FLEET_CAR_ONBOARDING_STAGES } from "./fleet-car";

type PageProps = {
  readonly actionData?: NewFleetCarActionData;
  readonly idempotencyKey: string;
  readonly verifying?: boolean;
};

function VerifiedVehicleCard({
  creatingDraft,
  draftError,
  verification,
}: {
  readonly creatingDraft: boolean;
  readonly draftError?: string;
  readonly verification: FleetVehicleVerification;
}) {
  const vehicle = verification.vehicle;

  return (
    <Card className="rounded-sm" role="status" aria-live="polite">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2Icon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle>
              <h3>Vehicle Details Checked</h3>
            </CardTitle>
            <CardDescription>Confirm these details before creating the draft.</CardDescription>
          </div>
        </div>
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
            <dt className="text-muted-foreground">Chassis number</dt>
            <dd className="mt-1 break-all font-medium">{vehicle.chassisNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Color</dt>
            <dd className="mt-1 font-medium">{vehicle.color ?? "Unknown"}</dd>
          </div>
          {vehicle.passengerCapacity != null ? (
            <div>
              <dt className="text-muted-foreground">Seats</dt>
              <dd className="mt-1 font-medium">{vehicle.passengerCapacity}</dd>
            </div>
          ) : null}
        </dl>
        <div className="space-y-3">
          <p className="font-medium">Are these the correct vehicle details?</p>
          {draftError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertTitle>Unable to continue</AlertTitle>
              <AlertDescription>{draftError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Form method="post">
              <input type="hidden" name="intent" value="create-draft" />
              <input type="hidden" name="verificationId" value={verification.id} />
              <Button type="submit" disabled={creatingDraft}>
                {creatingDraft ? "Creating Draft…" : "Yes, Add This Car"}
              </Button>
            </Form>
            <Button asChild variant="outline">
              <Link to="/fleet-owner/cars/new">No, Check Another Car</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FleetCarPlateVerificationPage({
  actionData,
  idempotencyKey,
  verifying: verifyingOverride,
}: PageProps) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const verifying = verifyingOverride ?? intent === "verify-plate";
  const verification = actionData?.verification;
  const [form, fields] = useForm({
    id: "fleet-car-plate-verification",
    lastResult: actionData?.submission,
    constraint: getZodConstraint(carOnboardingPlateFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carOnboardingPlateFormSchema });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/fleet-owner/cars">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back to cars
          </Link>
        </Button>
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Add a Verified Car
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the Nigerian number plate and chassis number to check the vehicle details.
        </p>
      </div>

      <QuestionnaireProgress
        ariaLabel="Car onboarding progress"
        currentStage="vehicle"
        stages={FLEET_CAR_ONBOARDING_STAGES.map((stage) => ({ ...stage, complete: false }))}
      />

      {verification?.eligibility.isEligible ? (
        <VerifiedVehicleCard
          creatingDraft={intent === "create-draft"}
          draftError={actionData?.error}
          verification={verification}
        />
      ) : (
        <Card className="rounded-sm">
          <CardHeader>
            <CardTitle>
              <h3>Verify Vehicle</h3>
            </CardTitle>
            <CardDescription>
              Use the plate and 17-character chassis number shown on your vehicle documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form
              key={idempotencyKey}
              method="post"
              {...getFormProps(form)}
              aria-busy={verifying || undefined}
              className="space-y-5"
            >
              <input type="hidden" name="intent" value="verify-plate" />
              <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(fields.plateNumber.errors)}>
                  <FieldLabel htmlFor={fields.plateNumber.id}>Number plate</FieldLabel>
                  <Input
                    {...getInputProps(fields.plateNumber, { type: "text" })}
                    className="h-10 rounded-sm"
                    placeholder="ABC 123 XY…"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={fields.plateNumber.errors ? true : undefined}
                  />
                  <FieldDescription>Examples: ABC-123XY, ABC123XY, or AB123XY.</FieldDescription>
                  <FieldError id={fields.plateNumber.errorId} errors={fields.plateNumber.errors} />
                </Field>
                <Field data-invalid={Boolean(fields.chassisNumber.errors)}>
                  <FieldLabel htmlFor={fields.chassisNumber.id}>Chassis number</FieldLabel>
                  <Input
                    {...getInputProps(fields.chassisNumber, { type: "text" })}
                    className="h-10 rounded-sm"
                    placeholder="JTJBM7FX3E5064535"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={fields.chassisNumber.errors ? true : undefined}
                  />
                  <FieldDescription>VINs exclude the letters I, O, and Q.</FieldDescription>
                  <FieldError
                    id={fields.chassisNumber.errorId}
                    errors={fields.chassisNumber.errors}
                  />
                </Field>
              </div>
              <FormError id={form.errorId} errors={form.errors} />
              {actionData?.error ? (
                <Alert variant="destructive">
                  <TriangleAlertIcon aria-hidden="true" />
                  <AlertTitle>Unable to continue</AlertTitle>
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={verifying}>
                {verifying ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <SearchIcon data-icon="inline-start" aria-hidden="true" />
                )}
                {verifying ? "Verifying Vehicle…" : "Verify Vehicle"}
              </Button>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
