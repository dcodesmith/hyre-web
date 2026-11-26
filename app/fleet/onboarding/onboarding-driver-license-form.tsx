import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { FileUpIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { OnboardingLicenseUploadField } from "./onboarding-driving-fields";
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
    <Form
      method="post"
      encType="multipart/form-data"
      {...getFormProps(form)}
      className="flex flex-col gap-14"
    >
      <div className="flex flex-col gap-5">
        <Separator />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold leading-7 text-foreground">
            Replace driver&apos;s licence
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            The previous file was rejected. Upload a clear replacement for review.
          </p>
        </div>

        <input type="hidden" name="intent" value="replace-driver-license" />
        <OnboardingLicenseUploadField field={fields.file} label="Driver's licence" />
        <FormError id={form.errorId} errors={form.errors} />
        {actionData?.intent === "replace-driver-license" && actionData.error ? (
          <FormError id="replace-driver-license-error" errors={[actionData.error]} />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="h-12 w-full rounded-md"
      >
        <FileUpIcon data-icon="inline-start" aria-hidden="true" />
        {pending ? "Uploading licence…" : "Upload replacement"}
      </Button>
    </Form>
  );
}
