import type {
  FleetCarApprovalStatus,
  FleetCarDocumentStatus,
  FleetCarStatus,
} from "~/api/fleet/cars/schema";
import { StatusBadge, type StatusBadgeTone } from "~/components/status-badge";
import { getFleetCarStatusLabel } from "./fleet-car";

const statusTones: Readonly<Record<FleetCarStatus, StatusBadgeTone>> = {
  AVAILABLE: "success",
  BOOKED: "info",
  HOLD: "warning",
  IN_SERVICE: "danger",
};

const reviewTones: Readonly<
  Record<FleetCarApprovalStatus | FleetCarDocumentStatus, StatusBadgeTone>
> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

export function FleetCarStatusBadge({ status }: { readonly status: FleetCarStatus }) {
  return <StatusBadge tone={statusTones[status]}>{getFleetCarStatusLabel(status)}</StatusBadge>;
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
    <StatusBadge className={className} tone={reviewTones[status]}>
      {label}
    </StatusBadge>
  );
}
