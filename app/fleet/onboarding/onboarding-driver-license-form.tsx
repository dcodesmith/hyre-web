import { FileUpIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { OnboardingActionData } from "./onboarding-form-schema";

export function OnboardingDriverLicenseForm({
  actionData,
}: {
  readonly actionData?: OnboardingActionData;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null &&
    navigation.formData?.get("intent") === "replace-driver-license";

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle>
          <h2>Replace Driver&apos;s Licence</h2>
        </CardTitle>
        <CardDescription>
          The previous file was rejected. Upload a clear replacement for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" encType="multipart/form-data" className="space-y-5">
          <input type="hidden" name="intent" value="replace-driver-license" />
          <Field>
            <FieldLabel htmlFor="replacement-driver-license">Driver&apos;s licence</FieldLabel>
            <Input
              id="replacement-driver-license"
              name="file"
              type="file"
              className="h-10 rounded-sm"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
            <FieldDescription>JPEG, PNG, WebP, or PDF. Maximum size: 5&nbsp;MB.</FieldDescription>
          </Field>
          {actionData?.intent === "replace-driver-license" && actionData.error ? (
            <FormError id="replace-driver-license-error" errors={[actionData.error]} />
          ) : null}
          <Button type="submit" disabled={pending} aria-live="polite">
            <FileUpIcon data-icon="inline-start" />
            {pending ? "Uploading licence…" : "Upload Replacement"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
