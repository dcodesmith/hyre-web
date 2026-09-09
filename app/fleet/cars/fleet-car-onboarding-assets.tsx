import { FileTextIcon, ImagesIcon, UploadIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export function CarDocumentStep() {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-documents";

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
        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <input type="hidden" name="intent" value="upload-documents" />
          <Field>
            <FieldLabel htmlFor="mot-certificate">MOT certificate</FieldLabel>
            <Input
              id="mot-certificate"
              name="motCertificate"
              type="file"
              className="h-10 rounded-sm"
              accept="application/pdf"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="insurance-certificate">Insurance certificate</FieldLabel>
            <Input
              id="insurance-certificate"
              name="insuranceCertificate"
              type="file"
              className="h-10 rounded-sm"
              accept="application/pdf"
              required
            />
            <FieldDescription>Each PDF must be 5&nbsp;MB or smaller.</FieldDescription>
          </Field>
          <Button type="submit" disabled={pending} aria-live="polite">
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Uploading Documents…" : "Upload Documents"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

export function CarImageStep() {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-images";

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
          Upload 1–5 clear exterior and interior photos together in one step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <input type="hidden" name="intent" value="upload-images" />
          <Field>
            <FieldLabel htmlFor="car-images">Car images</FieldLabel>
            <Input
              id="car-images"
              name="images"
              type="file"
              className="h-10 rounded-sm"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
            />
            <FieldDescription>
              Choose 1–5 JPEG, PNG, or WebP images, each under 5&nbsp;MB.
            </FieldDescription>
          </Field>
          <Button type="submit" disabled={pending} aria-live="polite">
            <UploadIcon data-icon="inline-start" aria-hidden="true" />
            {pending ? "Uploading Images…" : "Upload Images"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
