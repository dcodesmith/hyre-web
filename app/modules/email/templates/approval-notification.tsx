import { CarApprovalStatus, FleetOwnerStatus } from "@prisma/client";
import { Button, Heading, Hr, Section, Text, render } from "react-email";
import { getEmailPublicEnv } from "../email-public-env";
import { EmailTemplate } from "./EmailTemplate";

export interface CarApprovalEmailProps {
  readonly carDetails: { make: string; model: string; year: number; registration?: string }; // Added optional registration
  readonly status: CarApprovalStatus;
  readonly ownerName: string;
  readonly rejectionReason?: string; // Optional: provide a reason for rejection
}

type ApprovalRow = {
  readonly label: string;
  readonly value?: string;
};

function ApprovalDetailCard({
  sectionLabel,
  value,
  subline,
  rows,
  guidance,
  action,
}: {
  readonly sectionLabel: string;
  readonly value: string;
  readonly subline: string;
  readonly rows: readonly ApprovalRow[];
  readonly guidance?: string;
  readonly action?: { readonly href: string; readonly label: string };
}) {
  const visibleRows = rows.filter((row) => Boolean(row.value));

  return (
    <Section className="mt-6 border border-solid border-[#E6E6E8] rounded-[14px] overflow-hidden">
      <Section className="px-5 py-4">
        <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
          {sectionLabel}
        </Text>
        <Text className="text-[18px] leading-[24px] font-bold text-[#0B0B0F] m-0 mt-1">
          {value}
        </Text>
        <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">{subline}</Text>
      </Section>

      <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />

      <Section className="px-5 py-4">
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <td className="py-1 pr-2 align-top">
                  <Text className="m-0 text-[12px] leading-[18px] text-[#6A6A71]">{row.label}</Text>
                </td>
                <td align="right" className="py-1 align-top">
                  <Text className="m-0 text-[13px] leading-[18px] font-semibold text-[#0B0B0F]">
                    {row.value}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {(guidance || action) && (
        <>
          <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
          <Section className="px-5 py-4 bg-[#FAFAFB]">
            {guidance && (
              <Text className="m-0 text-[13px] leading-[18px] text-[#4A4A52]">{guidance}</Text>
            )}
            {action && (
              <Section className="mt-4 text-left">
                <Button
                  href={action.href}
                  className="bg-[#0B0B0F] text-white rounded-[10px] px-6 py-3 text-[14px] font-semibold no-underline inline-block"
                >
                  {action.label}
                </Button>
              </Section>
            )}
          </Section>
        </>
      )}
    </Section>
  );
}

export function CarApprovalEmail({
  carDetails,
  status,
  ownerName,
  rejectionReason,
}: CarApprovalEmailProps) {
  const { websiteUrl } = getEmailPublicEnv();
  const firstName = ownerName.split(" ")[0] || ownerName;
  const registrationSuffix = carDetails.registration ? ` - ${carDetails.registration}` : "";
  const carIdentifier = `${carDetails.make} ${carDetails.model} (${carDetails.year})${registrationSuffix}`;
  let subject: string;
  let overline: string;
  let heading: string;
  let intro: string;
  let subline: string;
  let statusText: string;
  let guidance: string;
  let action: { readonly href: string; readonly label: string } | undefined;

  const previewText = `Update on your vehicle: ${carIdentifier}`;

  switch (status) {
    case CarApprovalStatus.APPROVED:
      subject = `Your Vehicle ${carIdentifier} Has Been Approved!`;
      overline = "Vehicle approved";
      heading = `Great news, ${firstName}.`;
      intro = `Your vehicle ${carIdentifier} has been reviewed and approved by our admin team.`;
      subline = "Your listing is now eligible to go live.";
      statusText = "Approved";
      guidance = "You can now manage this vehicle and accept bookings from your fleet dashboard.";
      action = {
        href: `${websiteUrl}/fleet-owner/cars`,
        label: "Manage vehicles",
      };
      break;
    case CarApprovalStatus.REJECTED:
      subject = `Action Required: Update on Your Vehicle ${carIdentifier}`;
      overline = "Vehicle update";
      heading = `Update needed, ${firstName}.`;
      intro = `Your vehicle ${carIdentifier} was reviewed and cannot be approved yet.`;
      subline = "Please resolve the issue and resubmit.";
      statusText = "Rejected";
      guidance = "Review the rejection details, update your submission, then try again.";
      break;
    default: // PENDING or other statuses
      subject = `Your Vehicle ${carIdentifier} is Under Review`;
      overline = "Vehicle review";
      heading = `We're reviewing your vehicle, ${firstName}.`;
      intro = `Your vehicle ${carIdentifier} is currently under review by our admin team.`;
      subline = "We'll notify you as soon as the review is complete.";
      statusText = "Under review";
      guidance = "No action is needed right now. This usually completes within one business day.";
  }

  return (
    <EmailTemplate previewText={previewText} pageTitle={subject}>
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        {overline}
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        {heading}
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">{intro}</Text>

      <ApprovalDetailCard
        sectionLabel="Vehicle details"
        value={carIdentifier}
        subline={subline}
        guidance={guidance}
        action={action}
        rows={[
          { label: "Status", value: statusText },
          { label: "Rejection reason", value: rejectionReason },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderCarApprovalEmail(props: CarApprovalEmailProps) {
  return render(<CarApprovalEmail {...props} />);
}

// --- Fleet Owner Account Status Email ---
export interface FleetOwnerApprovalEmailProps {
  readonly status: FleetOwnerStatus;
  readonly ownerName: string;
  readonly reason?: string; // Optional: for ON_HOLD or REJECTED status
}

export function FleetOwnerApprovalEmail({
  status,
  ownerName,
  reason,
}: FleetOwnerApprovalEmailProps) {
  const { websiteUrl } = getEmailPublicEnv();
  const firstName = ownerName.split(" ")[0] || ownerName;
  let subject: string;
  let overline: string;
  let heading: string;
  let intro: string;
  let subline: string;
  let statusText: string;
  let guidance: string;
  let action: { readonly href: string; readonly label: string } | undefined;
  const previewText = "Update on your Fleet Owner Account";

  switch (status) {
    case FleetOwnerStatus.APPROVED:
      subject = "Congratulations! Your Fleet Owner Account is Approved";
      overline = "Account approved";
      heading = `You're approved, ${firstName}.`;
      intro = "Your Fleet Owner account has been approved and is now active.";
      subline = "You can now manage vehicles, bookings, and payouts.";
      statusText = "Approved";
      guidance = "Complete your setup and start adding vehicles to your fleet dashboard.";
      action = {
        href: `${websiteUrl}/fleet-owner`,
        label: "Go to dashboard",
      };
      break;
    // case FleetOwnerStatus.REJECTED:
    //   subject = "Update on Your Fleet Owner Account Application";
    //   mainHeading = "Account Application Update";
    //   messageBody = (
    //     <>
    //       <Text className="mb-3">
    //         Thank you for your interest in becoming a Fleet Owner on our platform.
    //       </Text>
    //       <Text className="mb-3">
    //         After careful review, we regret to inform you that your Fleet Owner account application
    //         has not been approved at this time.
    //       </Text>
    //       {reason && (
    //         <Section className="my-3 p-3 border border-gray-200 rounded-md bg-gray-50">
    //           <Text className="font-semibold m-0">Reason:</Text>
    //           <Text className="m-0">{reason}</Text>
    //         </Section>
    //       )}
    //       <Text className="mb-3">
    //         If you believe this is an error or wish to get more details, please contact our support
    //         team.
    //       </Text>
    //       <Text>
    //         Contact support:{" "}
    //         <Link
    //           href={`mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`}
    //           className="text-blue-600 underline"
    //         >
    //           {process.env.SUPPORT_EMAIL || "support@example.com"}
    //         </Link>
    //       </Text>
    //     </>
    //   );
    //   break;

    case FleetOwnerStatus.ON_HOLD:
      subject = "Action Required: Your Fleet Owner Account is On Hold";
      overline = "Account on hold";
      heading = `Action needed, ${firstName}.`;
      intro = "Your Fleet Owner account is currently on hold pending additional verification.";
      subline = "Please review the details and follow up with support.";
      statusText = "On hold";
      guidance =
        "Our team may need additional information before we can continue your approval process.";
      break;
    case FleetOwnerStatus.PROCESSING:
      subject = "Your Fleet Owner Account Application is Being Reviewed";
      overline = "Application in review";
      heading = `Thanks for your patience, ${firstName}.`;
      intro = "Your Fleet Owner application is under review by our operations team.";
      subline = "We'll email you once your status changes.";
      statusText = "Processing";
      guidance = "No action is required right now.";
      break;
    default:
      subject = "Update on Your Fleet Owner Account";
      overline = "Account status";
      heading = `Status updated, ${firstName}.`;
      intro = `Your Fleet Owner account status changed to ${status.toString().replace("_", " ")}.`;
      subline = "Log in to your dashboard or contact support for additional details.";
      statusText = status.toString().replace("_", " ");
      guidance = "If you have questions, our support team can help.";
  }

  return (
    <EmailTemplate previewText={previewText} pageTitle={subject}>
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        {overline}
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        {heading}
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">{intro}</Text>

      <ApprovalDetailCard
        sectionLabel="Fleet Owner account"
        value={ownerName}
        subline={subline}
        guidance={guidance}
        action={action}
        rows={[
          { label: "Status", value: statusText },
          { label: "Details", value: reason },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFleetOwnerApprovalEmail(props: FleetOwnerApprovalEmailProps) {
  return render(<FleetOwnerApprovalEmail {...props} />);
}
