import type { AdminCarApprovalStatus, AdminCarAssetStatus } from "~/api/admin/cars/schema";
import { StatusBadge, type StatusBadgeTone } from "~/components/status-badge";
import { getAdminCarReviewLabel } from "./car-approval";

const tones: Record<AdminCarApprovalStatus | AdminCarAssetStatus, StatusBadgeTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

export function AdminCarReviewBadge({
  className,
  status,
}: {
  readonly className?: string;
  readonly status: AdminCarApprovalStatus | AdminCarAssetStatus;
}) {
  return (
    <StatusBadge className={className} tone={tones[status]}>
      {getAdminCarReviewLabel(status)}
    </StatusBadge>
  );
}
