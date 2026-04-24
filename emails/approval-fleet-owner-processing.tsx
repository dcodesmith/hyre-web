import { FleetOwnerStatus } from "@prisma/client";
import {
  FleetOwnerApprovalEmail,
  type FleetOwnerApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalFleetOwnerProcessingPreview(props: FleetOwnerApprovalEmailProps) {
  return <FleetOwnerApprovalEmail {...props} />;
}

ApprovalFleetOwnerProcessingPreview.PreviewProps = {
  status: FleetOwnerStatus.PROCESSING,
  ownerName: "Sam Owner",
};
