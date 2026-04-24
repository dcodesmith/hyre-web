import { FleetOwnerStatus } from "@prisma/client";
import {
  FleetOwnerApprovalEmail,
  type FleetOwnerApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalFleetOwnerApprovedPreview(props: FleetOwnerApprovalEmailProps) {
  return <FleetOwnerApprovalEmail {...props} />;
}

ApprovalFleetOwnerApprovedPreview.PreviewProps = {
  status: FleetOwnerStatus.APPROVED,
  ownerName: "Sam Owner",
};
