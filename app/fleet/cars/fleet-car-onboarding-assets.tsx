import { CheckCircle2Icon, FileTextIcon, ImagesIcon, UploadIcon } from "lucide-react";
import { Form, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { StatusBadge } from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export function CarDocumentStep({ car }: { readonly car: FleetCar }) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-documents";
  const complete = car.documents.length >= 2;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <StatusBadge tone={complete ? "success" : "muted"}>
            {complete ? "Complete" : "Required"}
          </StatusBadge>
        </div>
        <CardTitle>
          <h3>Vehicle Documents</h3>
        </CardTitle>
        <CardDescription>Upload the MOT and insurance certificates as PDFs.</CardDescription>
      </CardHeader>
      <CardContent>
        {complete ? (
          <div className="space-y-2">
            {car.documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-2 rounded-md border p-3 text-sm"
              >
                <CheckCircle2Icon className="size-4 text-green-600" aria-hidden="true" />
                {document.documentType === "MOT_CERTIFICATE"
                  ? "MOT certificate"
                  : "Insurance certificate"}
              </div>
            ))}
          </div>
        ) : (
          <Form method="post" encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="intent" value="upload-documents" />
            <Field>
              <FieldLabel htmlFor="mot-certificate">MOT certificate</FieldLabel>
              <Input
                id="mot-certificate"
                name="motCertificate"
                type="file"
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
                accept="application/pdf"
                required
              />
              <FieldDescription>Each PDF must be 5&nbsp;MB or smaller.</FieldDescription>
            </Field>
            <Button type="submit" disabled={pending} aria-live="polite">
              <UploadIcon data-icon="inline-start" />
              {pending ? "Uploading documents…" : "Upload documents"}
            </Button>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function CarImageStep({ car }: { readonly car: FleetCar }) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "upload-images";
  const complete = car.images.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <ImagesIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <StatusBadge tone={complete ? "success" : "muted"}>
            {complete ? `${car.images.length} uploaded` : "Required"}
          </StatusBadge>
        </div>
        <CardTitle>
          <h3>Vehicle Photos</h3>
        </CardTitle>
        <CardDescription>Upload up to five clear exterior and interior photos.</CardDescription>
      </CardHeader>
      <CardContent>
        {complete ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {car.images.map((image, index) => (
              <img
                key={image.id}
                src={image.url}
                alt={`${car.make} ${car.model}, uploaded view ${index + 1}`}
                className="aspect-video size-full rounded-lg object-cover"
                width={640}
                height={360}
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <Form method="post" encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="intent" value="upload-images" />
            <Field>
              <FieldLabel htmlFor="car-images">Car images</FieldLabel>
              <Input
                id="car-images"
                name="images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
              />
              <FieldDescription>
                Choose 1–5 JPEG, PNG, or WebP images, each under 5&nbsp;MB.
              </FieldDescription>
            </Field>
            <Button type="submit" disabled={pending} aria-live="polite">
              <UploadIcon data-icon="inline-start" />
              {pending ? "Uploading images…" : "Upload images"}
            </Button>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
