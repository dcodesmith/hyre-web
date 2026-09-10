import { SendIcon, ShieldCheckIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

type Props = {
  readonly car: FleetCar;
  readonly idempotencyKey: string;
};

export function CarSubmissionStep({ car, idempotencyKey }: Props) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const pending = navigation.formMethod != null && intent === "submit-car";
  const verifyingInsurance = navigation.formMethod != null && intent === "verify-insurance";
  const verification = car.insuranceVerifications[0];
  const insuranceIsCurrent =
    verification?.status === "SUCCEEDED" &&
    verification.policyExpiresAt !== null &&
    Date.parse(verification.policyExpiresAt) > Date.now();

  if (!insuranceIsCurrent) {
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
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="verify-insurance" />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <Field>
              <FieldLabel htmlFor="policy-number">Policy number</FieldLabel>
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
              <FieldDescription>Use the policy number on the current certificate.</FieldDescription>
            </Field>
            <Button type="submit" disabled={verifyingInsurance} aria-live="polite">
              {verifyingInsurance ? "Verifying Insurance…" : "Verify Insurance"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    );
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
