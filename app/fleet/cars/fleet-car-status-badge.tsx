import type {
  FleetCarApprovalStatus,
  FleetCarDocumentStatus,
  FleetCarStatus,
} from "~/api/fleet/cars/schema";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { getFleetCarStatusLabel } from "./fleet-car";

const fleetBadgeClassName =
  "h-6 rounded-md border-none px-2.5 leading-none font-semibold ring-1 ring-inset";

const fleetBadgeTones = {
  green: "bg-green-50 text-green-600 ring-green-600/10",
  blue: "bg-blue-50 text-blue-600 ring-blue-600/10",
  yellow: "bg-yellow-50 text-yellow-600 ring-yellow-600/10",
  red: "bg-red-50 text-red-600 ring-red-600/10",
} as const;

type FleetBadgeTone = keyof typeof fleetBadgeTones;

const statusTones: Readonly<Record<FleetCarStatus, FleetBadgeTone>> = {
  AVAILABLE: "green",
  BOOKED: "blue",
  HOLD: "yellow",
  IN_SERVICE: "red",
};

const reviewTones: Readonly<
  Record<FleetCarApprovalStatus | FleetCarDocumentStatus, FleetBadgeTone>
> = {
  APPROVED: "green",
  PENDING: "yellow",
  REJECTED: "red",
};

function FleetBadge({
  children,
  className,
  tone,
}: {
  readonly children: string;
  readonly className?: string;
  readonly tone: FleetBadgeTone;
}) {
  return (
    <Badge variant="outline" className={cn(fleetBadgeClassName, fleetBadgeTones[tone], className)}>
      {children}
    </Badge>
  );
}

export function FleetCarStatusBadge({ status }: { readonly status: FleetCarStatus }) {
  return <FleetBadge tone={statusTones[status]}>{getFleetCarStatusLabel(status)}</FleetBadge>;
}

export function FleetCarReviewBadge({
  className,
  label,
  status,
}: {
  readonly className?: string;
  readonly label: string;
  readonly status: FleetCarApprovalStatus | FleetCarDocumentStatus;
}) {
  return (
    <FleetBadge className={className} tone={reviewTones[status]}>
      {label}
    </FleetBadge>
  );
}
