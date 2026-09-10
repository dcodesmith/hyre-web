import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { FileTextIcon, ImagesIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useImageFilePreviews } from "~/hooks/use-image-file-previews";
import {
  carOnboardingDocumentsFormSchema,
  carOnboardingImagesFormSchema,
  type FleetCarOnboardingActionData,
} from "./car-onboarding-form-schema";

type StepProps = {
  readonly actionData?: FleetCarOnboardingActionData;
};

export function CarDocumentStep({ actionData }: StepProps) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-documents";
  const [form, fields] = useForm({
    id: "fleet-car-onboarding-documents",
    lastResult: actionData?.intent === "upload-documents" ? actionData.submission : null,
    constraint: getZodConstraint(carOnboardingDocumentsFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carOnboardingDocumentsFormSchema });
    },
  });

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>
            <h3>Vehicle Documents</h3>
          </CardTitle>
        </div>
        <CardDescription>Upload the MOT and insurance certificates as PDFs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          method="post"
          encType="multipart/form-data"
          {...getFormProps(form)}
          className="space-y-4"
        >
          <input type="hidden" name="intent" value="upload-documents" />
          <Field data-invalid={Boolean(fields.motCertificate.errors)}>
            <FieldLabel htmlFor={fields.motCertificate.id}>MOT certificate</FieldLabel>
            <Input
              {...getInputProps(fields.motCertificate, { type: "file" })}
              className="h-10 rounded-sm"
              accept="application/pdf"
              aria-invalid={fields.motCertificate.errors ? true : undefined}
            />
            <FieldError id={fields.motCertificate.errorId} errors={fields.motCertificate.errors} />
          </Field>
          <Field data-invalid={Boolean(fields.insuranceCertificate.errors)}>
            <FieldLabel htmlFor={fields.insuranceCertificate.id}>Insurance certificate</FieldLabel>
            <Input
              {...getInputProps(fields.insuranceCertificate, { type: "file" })}
              className="h-10 rounded-sm"
              accept="application/pdf"
              aria-invalid={fields.insuranceCertificate.errors ? true : undefined}
            />
            <FieldDescription>Each PDF must be 5&nbsp;MB or smaller.</FieldDescription>
            <FieldError
              id={fields.insuranceCertificate.errorId}
              errors={fields.insuranceCertificate.errors}
            />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          <Button type="submit" disabled={pending} aria-live="polite">
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Uploading Documents…" : "Upload Documents"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

export function CarImageStep({ actionData }: StepProps) {
  const navigation = useNavigation();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedImages, setSelectedImages] = useState<readonly File[]>([]);
  const imagePreviews = useImageFilePreviews(selectedImages);
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-images";
  const [form, fields] = useForm({
    id: "fleet-car-onboarding-images",
    lastResult: actionData?.intent === "upload-images" ? actionData.submission : null,
    constraint: getZodConstraint(carOnboardingImagesFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carOnboardingImagesFormSchema });
    },
  });

  function removeImage(index: number) {
    const input = imageInputRef.current;
    if (!input) return;

    const remainingImages = selectedImages.filter((_, imageIndex) => imageIndex !== index);
    const transfer = new DataTransfer();
    for (const image of remainingImages) {
      transfer.items.add(image);
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ImagesIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>
            <h3>Vehicle Photos</h3>
          </CardTitle>
        </div>
        <CardDescription>
          Upload 3–5 clear exterior and interior photos together in one step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          method="post"
          encType="multipart/form-data"
          {...getFormProps(form)}
          className="space-y-4"
        >
          <input type="hidden" name="intent" value="upload-images" />
          <Field data-invalid={Boolean(fields.images.errors)}>
            <FieldLabel htmlFor={fields.images.id}>Car images</FieldLabel>
            <Input
              {...getInputProps(fields.images, { type: "file" })}
              ref={imageInputRef}
              className="h-10 rounded-sm"
              accept="image/jpeg,image/png,image/webp"
              multiple
              aria-invalid={fields.images.errors ? true : undefined}
              onChange={(event) => setSelectedImages(Array.from(event.currentTarget.files ?? []))}
            />
            {imagePreviews.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imagePreviews.map(({ file, url }, index) => (
                  <li
                    key={url}
                    className="relative aspect-square overflow-hidden rounded-sm border bg-muted"
                  >
                    <img
                      src={url}
                      alt={file.name}
                      className="size-full object-cover"
                      width={240}
                      height={240}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      className="absolute top-2 right-2 shadow-sm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeImage(index)}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <FieldDescription>
              Choose 3–5 JPEG, PNG, or WebP images, each under 5&nbsp;MB.
            </FieldDescription>
            <FieldError id={fields.images.errorId} errors={fields.images.errors} />
          </Field>
          <FormError id={form.errorId} errors={form.errors} />
          <Button type="submit" disabled={pending} aria-live="polite">
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Uploading Images…" : "Upload Images"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
