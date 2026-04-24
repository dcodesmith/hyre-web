import { CarApprovalStatus } from "@prisma/client";
import { sampleCarDetails } from "../app/modules/email/fixtures/preview-fixtures";
import {
  CarApprovalEmail,
  type CarApprovalEmailProps,
} from "../app/modules/email/templates/approval-notification";

export default function ApprovalCarPendingPreview(props: CarApprovalEmailProps) {
  return <CarApprovalEmail {...props} />;
}

ApprovalCarPendingPreview.PreviewProps = {
  carDetails: sampleCarDetails,
  status: CarApprovalStatus.PENDING,
  ownerName: "Sam Owner",
};
