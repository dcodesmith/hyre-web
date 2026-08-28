import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, ImageIcon, StarIcon } from "lucide-react";
import { Link, useFetcher } from "react-router";

import type { AdminPortalRole } from "~/auth/auth-form-schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import type { AdminCarActionData } from "./admin-car-action-schema";
import { AdminCarAssetActions } from "./admin-car-asset-actions";
import { AdminCarReviewBadge } from "./admin-car-review-badge";
import { type AdminCarsQuery, serializeAdminCarsQuery } from "./admin-cars-url";
import { type AdminCarDetailData, getAdminCarDocumentTypeLabel } from "./car-approval";

function ownerName(car: AdminCarDetailData) {
  return car.owner.name?.trim() || car.owner.username?.trim() || "Fleet owner";
}

function MutationError({ error }: { readonly error?: string }) {
  return error ? (
    <p role="alert" className="mt-2 text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

function ApproveCarButton() {
  const fetcher = useFetcher<AdminCarActionData>();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <div>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="approve-car" />
        <Button type="submit" disabled={isSubmitting}>
          <CheckIcon data-icon="inline-start" />
          {isSubmitting ? "Approving…" : "Approve car"}
        </Button>
      </fetcher.Form>
      <MutationError error={fetcher.state === "idle" ? fetcher.data?.error : undefined} />
    </div>
  );
}

function SetCoverButton({ imageId }: { readonly imageId: string }) {
  const fetcher = useFetcher<AdminCarActionData>();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <div>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="set-cover" />
        <input type="hidden" name="assetId" value={imageId} />
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          <StarIcon data-icon="inline-start" />
          {isSubmitting ? "Saving…" : "Set as cover"}
        </Button>
      </fetcher.Form>
      <MutationError error={fetcher.state === "idle" ? fetcher.data?.error : undefined} />
    </div>
  );
}

export function AdminCarDetail({
  car,
  query,
  role,
}: {
  readonly car: AdminCarDetailData;
  readonly query: AdminCarsQuery;
  readonly role: AdminPortalRole;
}) {
  const backSearch = serializeAdminCarsQuery(query).toString();
  const backHref = backSearch ? `/admin/cars?${backSearch}` : "/admin/cars";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Button asChild className="-ml-2 mb-3" variant="ghost">
          <Link to={backHref}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back to car reviews
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {car.year} {car.make} {car.model}
              </h2>
              <AdminCarReviewBadge status={car.approvalStatus} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {car.registrationNumber} · {ownerName(car)}
            </p>
          </div>
          {role === "admin" && car.approvalStatus !== "APPROVED" ? <ApproveCarButton /> : null}
        </div>
      </div>

      {car.approvalNotes ? (
        <Alert variant={car.approvalStatus === "REJECTED" ? "destructive" : "default"}>
          <AlertTitle>Review note</AlertTitle>
          <AlertDescription>{car.approvalNotes}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Vehicle and owner</h3>
          </CardTitle>
          <CardDescription>Registration and fleet-owner details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-medium">Registration</dt>
              <dd className="mt-1 text-muted-foreground">{car.registrationNumber}</dd>
            </div>
            <div>
              <dt className="font-medium">Vehicle</dt>
              <dd className="mt-1 text-muted-foreground">
                {car.color} {car.vehicleType.toLowerCase()} · {car.passengerCapacity} seats
              </dd>
            </div>
            <div>
              <dt className="font-medium">Owner</dt>
              <dd className="mt-1 text-muted-foreground">{ownerName(car)}</dd>
            </div>
            <div>
              <dt className="font-medium">Owner email</dt>
              <dd className="mt-1 break-all text-muted-foreground">{car.owner.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="admin-car-images-heading" className="space-y-3">
        <div>
          <h3 id="admin-car-images-heading" className="text-xl font-semibold">
            Vehicle images
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Approving the final required asset may approve the car automatically.
          </p>
        </div>
        {car.images.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 size-5" />
            No vehicle images submitted.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {car.images.map((image, index) => (
              <Card key={image.id} className="overflow-hidden pt-0">
                <figure className="relative aspect-video bg-muted">
                  <img
                    src={image.url}
                    alt={`${car.year} ${car.make} ${car.model}, view ${index + 1}`}
                    className="size-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <AdminCarReviewBadge
                    status={image.status}
                    className="absolute right-3 bottom-3"
                  />
                </figure>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      Image {index + 1}
                      {image.isPrimary ? " · Cover" : ""}
                    </p>
                    {role === "admin" && image.status === "APPROVED" && !image.isPrimary ? (
                      <SetCoverButton imageId={image.id} />
                    ) : null}
                  </div>
                  {image.notes ? (
                    <p className="text-sm text-muted-foreground">{image.notes}</p>
                  ) : null}
                  <AdminCarAssetActions assetId={image.id} kind="image" status={image.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Documents</h3>
          </CardTitle>
          <CardDescription>Review submitted MOT and insurance certificates.</CardDescription>
        </CardHeader>
        <CardContent>
          {car.documents.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No documents submitted.</p>
          ) : (
            car.documents.map((document, index) => (
              <div key={document.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">
                        {getAdminCarDocumentTypeLabel(document.documentType)}
                      </h4>
                      <AdminCarReviewBadge status={document.status} />
                    </div>
                    {document.notes ? (
                      <p className="mt-1 text-sm text-muted-foreground">{document.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Button asChild variant="outline">
                      <a href={`/admin/documents/${document.id}`} target="_blank" rel="noreferrer">
                        View document
                        <ExternalLinkIcon data-icon="inline-end" />
                      </a>
                    </Button>
                    <AdminCarAssetActions
                      assetId={document.id}
                      kind="document"
                      status={document.status}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
