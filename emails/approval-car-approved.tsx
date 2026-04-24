import { CarApprovalStatus } from "@prisma/client";
import { sampleCarDetails } from "../app/modules/email/fixtures/preview-fixtures";
import {
  CarApprovalEmail,
  type CarApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalCarApprovedPreview(props: CarApprovalEmailProps) {
  return <CarApprovalEmail {...props} />;
}

ApprovalCarApprovedPreview.PreviewProps = {
  carDetails: sampleCarDetails,
  status: CarApprovalStatus.APPROVED,
  ownerName: "Sam Owner",
};
