import { SendIcon, ShieldCheckIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { StatusBadge } from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export function CarInsuranceStep({
  car,
  idempotencyKey,
}: {
  readonly car: FleetCar;
  readonly idempotencyKey: string;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-insurance";
  const verification = car.insuranceVerifications[0];
  const complete = verification?.status === "SUCCEEDED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <ShieldCheckIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <StatusBadge tone={complete ? "success" : "muted"}>
            {complete ? "Verified" : "Required"}
          </StatusBadge>
        </div>
        <CardTitle>
          <h3>Verify Insurance</h3>
        </CardTitle>
        <CardDescription>
          Enter the policy number from the insurance certificate you uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {complete ? (
          <p className="text-sm text-muted-foreground">
            Policy <span className="font-medium text-foreground">{verification.policyNumber}</span>{" "}
            is verified.
          </p>
        ) : (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="verify-insurance" />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <Field>
              <FieldLabel htmlFor="policy-number">Policy number</FieldLabel>
              <Input
                id="policy-number"
                name="policyNumber"
                minLength={3}
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <FieldDescription>
                Once verification succeeds, use the final submission button below.
              </FieldDescription>
            </Field>
            <Button type="submit" disabled={pending} aria-live="polite">
              {pending ? "Verifying insurance…" : "Verify Insurance"}
            </Button>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function CarSubmissionStep() {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "submit-car";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Submit for Approval</h3>
        </CardTitle>
        <CardDescription>
          Tripdly checks that documents, photos, pricing, and insurance verification are complete.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post">
          <input type="hidden" name="intent" value="submit-car" />
          <Button type="submit" disabled={pending} aria-live="polite">
            <SendIcon data-icon="inline-start" />
            {pending ? "Submitting car…" : "Submit car for approval"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
