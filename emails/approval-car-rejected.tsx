import { CarApprovalStatus } from "@prisma/client";
import { sampleCarDetails } from "../app/modules/email/fixtures/preview-fixtures";
import {
  CarApprovalEmail,
  type CarApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalCarRejectedPreview(props: CarApprovalEmailProps) {
  return <CarApprovalEmail {...props} />;
}

ApprovalCarRejectedPreview.PreviewProps = {
  carDetails: sampleCarDetails,
  status: CarApprovalStatus.REJECTED,
  ownerName: "Sam Owner",
  rejectionReason: "Registration documents were unclear. Please re-upload legible photos.",
};
