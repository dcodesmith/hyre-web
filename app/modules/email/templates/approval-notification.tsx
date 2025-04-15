import { CarApprovalStatus, FleetOwnerStatus } from "@prisma/client";
import { EmailTemplate } from "./EmailTemplate";

export function CarApprovalEmail({
  carDetails,
  status,
  ownerName,
}: {
  carDetails: { make: string; model: string; year: number };
  status: CarApprovalStatus;
  ownerName: string;
}) {
  return (
    <EmailTemplate>
      <h1>Car {status === CarApprovalStatus.APPROVED ? "Approval" : "Rejection"} Notification</h1>
      <p>Dear {ownerName},</p>
      <p>
        Your car {carDetails.make} {carDetails.model} ({carDetails.year}) has been{" "}
        {status === CarApprovalStatus.APPROVED ? "approved" : "rejected"} by our admin team.
      </p>
      {status === CarApprovalStatus.REJECTED && (
        <p>Please contact our support team for more information about the rejection.</p>
      )}
    </EmailTemplate>
  );
}

export function FleetOwnerApprovalEmail({
  status,
  ownerName,
}: {
  status: FleetOwnerStatus;
  ownerName: string;
}) {
  return (
    <EmailTemplate>
      <h1>Fleet Owner Status Update</h1>
      <p>Dear {ownerName},</p>
      <p>Your fleet owner status has been updated to: {status}</p>
      {status === FleetOwnerStatus.APPROVED && <p>You can now start adding cars to your fleet.</p>}
      {status === FleetOwnerStatus.ON_HOLD && (
        <p>Please contact our support team for more information.</p>
      )}
    </EmailTemplate>
  );
}
