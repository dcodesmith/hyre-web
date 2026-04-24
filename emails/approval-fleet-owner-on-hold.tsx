import { FleetOwnerStatus } from "@prisma/client";
import {
  FleetOwnerApprovalEmail,
  type FleetOwnerApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalFleetOwnerOnHoldPreview(props: FleetOwnerApprovalEmailProps) {
  return <FleetOwnerApprovalEmail {...props} />;
}

ApprovalFleetOwnerOnHoldPreview.PreviewProps = {
  status: FleetOwnerStatus.ON_HOLD,
  ownerName: "Sam Owner",
  reason: "We need a copy of your business registration before we can continue.",
};
