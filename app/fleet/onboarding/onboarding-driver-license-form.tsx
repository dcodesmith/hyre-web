import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { FileUpIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  type OnboardingActionData,
  onboardingDriverLicenseReplacementFormSchema,
} from "./onboarding-form-schema";

export function OnboardingDriverLicenseForm({
  actionData,
}: {
  readonly actionData?: OnboardingActionData;
}) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null &&
    navigation.formData?.get("intent") === "replace-driver-license";
  const [form, fields] = useForm({
    id: "fleet-owner-replace-driver-license",
    lastResult: actionData?.intent === "replace-driver-license" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingDriverLicenseReplacementFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingDriverLicenseReplacementFormSchema });
    },
  });

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
        <Form
          method="post"
          encType="multipart/form-data"
          {...getFormProps(form)}
          className="space-y-5"
        >
          <input type="hidden" name="intent" value="replace-driver-license" />
          <Field data-invalid={Boolean(fields.file.errors)}>
            <FieldLabel htmlFor={fields.file.id}>Driver&apos;s licence</FieldLabel>
            <Input
              {...getInputProps(fields.file, { type: "file" })}
              className="h-10 rounded-sm"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-invalid={fields.file.errors ? true : undefined}
            />
            <FieldDescription>JPEG, PNG, WebP, or PDF. Maximum size: 5&nbsp;MB.</FieldDescription>
            <FieldError id={fields.file.errorId} errors={fields.file.errors} />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
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
