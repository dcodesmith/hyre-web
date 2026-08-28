import { ArrowLeftIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { Link } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";
import {
  getFleetCarApprovalLabel,
  getFleetCarDocumentStatusLabel,
  getFleetCarDocumentTypeLabel,
  getFleetCarServiceTierLabel,
  getFleetCarVehicleTypeLabel,
} from "./fleet-car";
import { FleetCarReviewBadge, FleetCarStatusBadge } from "./fleet-car-status-badge";

function DetailRow({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-4">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground sm:text-right">{value}</dd>
    </div>
  );
}

function DetailList({ children }: { readonly children: React.ReactNode }) {
  return <dl className="divide-y">{children}</dl>;
}

export function FleetCarDetail({ car }: { readonly car: FleetCar }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Button asChild className="-ml-2 mb-3" size="sm" variant="ghost">
          <Link to="/fleet-owner/cars">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to cars
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {car.make} {car.model}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {car.year} · {car.registrationNumber}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FleetCarStatusBadge status={car.status} />
            <FleetCarReviewBadge
              label={getFleetCarApprovalLabel(car.approvalStatus)}
              status={car.approvalStatus}
            />
          </div>
        </div>
      </div>

      {car.approvalStatus === "REJECTED" && car.approvalNotes ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Approval needs attention</AlertTitle>
          <AlertDescription>{car.approvalNotes}</AlertDescription>
        </Alert>
      ) : null}

      {car.images.length > 0 ? (
        <section aria-labelledby="fleet-car-images-heading">
          <h3 id="fleet-car-images-heading" className="sr-only">
            Vehicle images
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {car.images.map((image, index) => (
              <figure
                key={image.id}
                className={cn(
                  "relative aspect-video overflow-hidden rounded-xl bg-muted",
                  index === 0 && "sm:col-span-2",
                )}
              >
                <img
                  src={image.url}
                  alt={`${car.year} ${car.make} ${car.model}, view ${index + 1}`}
                  className="size-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <FleetCarReviewBadge
                  className="absolute right-3 bottom-3"
                  label={getFleetCarDocumentStatusLabel(image.status)}
                  status={image.status}
                />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Vehicle details</h3>
            </CardTitle>
            <CardDescription>Registration and fleet classification.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Make and model" value={`${car.make} ${car.model}`} />
              <DetailRow label="Year" value={car.year} />
              <DetailRow label="Registration number" value={car.registrationNumber} />
              <DetailRow
                label="Vehicle type"
                value={getFleetCarVehicleTypeLabel(car.vehicleType)}
              />
              <DetailRow
                label="Service tier"
                value={getFleetCarServiceTierLabel(car.serviceTier)}
              />
              <DetailRow
                label="Passenger capacity"
                value={`${car.passengerCapacity} passenger${car.passengerCapacity === 1 ? "" : "s"}`}
              />
              <DetailRow label="Color" value={car.color || "Not specified"} />
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Pricing</h3>
            </CardTitle>
            <CardDescription>Current customer-facing base rates.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Hourly rate" value={formatCurrency(car.hourlyRate)} />
              <DetailRow label="Daily rate (12 hours)" value={formatCurrency(car.dayRate)} />
              <DetailRow label="Nightly rate (11pm to 5am)" value={formatCurrency(car.nightRate)} />
              <DetailRow label="Full day rate (24 hours)" value={formatCurrency(car.fullDayRate)} />
              <DetailRow
                label="Airport pickup rate"
                value={formatCurrency(car.airportPickupRate)}
              />
              <DetailRow label="Fuel included" value={car.pricingIncludesFuel ? "Yes" : "No"} />
              {!car.pricingIncludesFuel && car.fuelUpgradeRate != null ? (
                <DetailRow label="Fuel upgrade rate" value={formatCurrency(car.fuelUpgradeRate)} />
              ) : null}
            </DetailList>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Documents</h3>
          </CardTitle>
          <CardDescription>MOT and insurance approval status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {car.documents.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No documents available.</p>
          ) : (
            car.documents.map((document, index) => (
              <div key={document.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {getFleetCarDocumentTypeLabel(document.documentType)}
                    </p>
                    {document.notes ? (
                      <p className="mt-1 text-sm text-muted-foreground">{document.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <FleetCarReviewBadge
                      label={getFleetCarDocumentStatusLabel(document.status)}
                      status={document.status}
                    />
                    <Button asChild size="sm" variant="outline">
                      <a href={document.documentUrl} target="_blank" rel="noreferrer">
                        View
                        <ExternalLinkIcon data-icon="inline-end" />
                      </a>
                    </Button>
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
