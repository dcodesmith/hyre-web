import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { SendIcon, ShieldCheckIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  carOnboardingInsuranceFormSchema,
  type FleetCarOnboardingActionData,
} from "./car-onboarding-form-schema";

type Props = {
  readonly actionData?: FleetCarOnboardingActionData;
  readonly car: FleetCar;
  readonly idempotencyKey: string;
};

function InsuranceRecoveryForm({
  actionData,
  idempotencyKey,
}: Pick<Props, "actionData" | "idempotencyKey">) {
  const navigation = useNavigation();
  const verifyingInsurance =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-insurance";
  const [form, fields] = useForm({
    id: "fleet-car-onboarding-insurance",
    lastResult: actionData?.intent === "verify-insurance" ? actionData.submission : null,
    constraint: getZodConstraint(carOnboardingInsuranceFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carOnboardingInsuranceFormSchema });
    },
  });

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>
            <h3>Renew Insurance</h3>
          </CardTitle>
        </div>
        <CardDescription>
          Your insurance verification is missing or expired. Verify the current policy before
          submitting this car.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" {...getFormProps(form)} className="space-y-4">
          <input type="hidden" name="intent" value="verify-insurance" />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Field data-invalid={Boolean(fields.policyNumber.errors)}>
            <FieldLabel htmlFor={fields.policyNumber.id}>Policy number</FieldLabel>
            <Input
              {...getInputProps(fields.policyNumber, { type: "text" })}
              className="h-10 rounded-sm"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={fields.policyNumber.errors ? true : undefined}
            />
            <FieldDescription>Use the policy number on the current certificate.</FieldDescription>
            <FieldError id={fields.policyNumber.errorId} errors={fields.policyNumber.errors} />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          <Button type="submit" disabled={verifyingInsurance} aria-live="polite">
            {verifyingInsurance ? "Verifying Insurance…" : "Verify Insurance"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

export function CarSubmissionStep({ actionData, car, idempotencyKey }: Props) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "submit-car";
  const verification = car.insuranceVerifications[0];
  const insuranceIsCurrent =
    verification?.status === "SUCCEEDED" &&
    verification.policyExpiresAt !== null &&
    Date.parse(verification.policyExpiresAt) > Date.now();

  if (!insuranceIsCurrent) {
    return <InsuranceRecoveryForm actionData={actionData} idempotencyKey={idempotencyKey} />;
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h3>Submit for Approval</h3>
        </CardTitle>
        <CardDescription>
          Submit this car for review. Its verified vehicle, documents, photos, and pricing are
          ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post">
          <input type="hidden" name="intent" value="submit-car" />
          <Button type="submit" disabled={pending} aria-live="polite">
            <SendIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Submitting Car…" : "Submit Car for Approval"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
