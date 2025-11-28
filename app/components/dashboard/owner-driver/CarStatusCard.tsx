import { DocumentApproval } from "@prisma/client";
import { Link } from "@remix-run/react";
import { AlertTriangle, Car, Clock, ExternalLink, FileCheck, Wrench } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { CarInfo } from "./types";

interface CarStatusCardProps {
  readonly car?: CarInfo;
}

function DocumentStatus({
  label,
  document,
}: { readonly label: string; readonly document?: DocumentApproval }) {
  if (!document) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant="outline" className="bg-muted">
          Not Uploaded
        </Badge>
      </div>
    );
  }

  const statusConfig = {
    PENDING: {
      variant: "outline" as const,
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Pending Review",
    },
    APPROVED: {
      variant: "secondary" as const,
      className:
        "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
      icon: <FileCheck className="h-3.5 w-3.5" />,
      label: "Approved",
    },
    REJECTED: {
      variant: "destructive" as const,
      className: "",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "Rejected",
    },
  };

  const config = statusConfig[document.status] || statusConfig.PENDING;

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={config.variant} className={cn("gap-1", config.className)}>
        {config.icon}
        {config.label}
      </Badge>
    </div>
  );
}

const statusConfig = {
  AVAILABLE: {
    label: "Available",
    variant: "default" as const,
    className:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
    dotColor: "bg-green-500",
  },
  BOOKED: {
    label: "Booked",
    variant: "secondary" as const,
    className:
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  IN_SERVICE: {
    label: "In Service",
    variant: "outline" as const,
    className:
      "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
    dotColor: "bg-orange-500",
  },
  HOLD: {
    label: "On Hold",
    variant: "secondary" as const,
    className:
      "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800",
    dotColor: "bg-gray-500",
  },
};

export function CarStatusCard({ car }: CarStatusCardProps) {
  if (!car) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Car className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Car Added</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Add your vehicle to start receiving bookings.
          </p>
          <Button asChild>
            <Link to="/fleet-owner/cars">Add Your Car</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[car.status] || statusConfig.AVAILABLE;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" />
            Your Car
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/fleet-owner/cars/${car.id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">
            {car.make} {car.model} {car.year}
          </h3>
          <p className="text-sm text-muted-foreground font-mono">{car.registrationNumber}</p>
        </div>

        <div>
          <Badge variant={status.variant} className={cn("gap-1.5", status.className)}>
            <div className={cn("h-2 w-2 rounded-full", status.dotColor)} />
            {status.label}
          </Badge>
        </div>

        <div className="space-y-1 pt-2 border-t">
          <DocumentStatus label="Insurance Certificate" document={car.insuranceCertificate} />
          <DocumentStatus label="MOT Certificate" document={car.motCertificate} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to={`/fleet-owner/cars/${car.id}`}>
              <Wrench className="h-4 w-4 mr-1" />
              Update
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
