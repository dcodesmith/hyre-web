import type { AdminCarApprovalStatus, AdminCarAssetStatus } from "~/api/admin/cars/schema";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { getAdminCarReviewLabel } from "./car-approval";

const tones: Record<AdminCarApprovalStatus | AdminCarAssetStatus, string> = {
  APPROVED: "bg-green-50 text-green-700 ring-green-600/15",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/15",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/15",
};

export function AdminCarReviewBadge({
  className,
  status,
}: {
  readonly className?: string;
  readonly status: AdminCarApprovalStatus | AdminCarAssetStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md border-none px-2.5 font-semibold ring-1 ring-inset",
        tones[status],
        className,
      )}
    >
      {getAdminCarReviewLabel(status)}
    </Badge>
  );
}
