import {
  Heading,
  Text,
  Section,
  Link, // Added for support links
} from "@react-email/components";
import { render } from "@react-email/render";
import { EmailTemplate } from "./EmailTemplate";
import { CarApprovalStatus, FleetOwnerStatus } from "@prisma/client";
// Assuming these enums are defined in EmailShared.ts or directly imported if from Prisma
// import { CarApprovalStatus, FleetOwnerStatus } from "./EmailShared"; // Or your actual path to type definitions

// --- Car Approval/Rejection Email ---
interface CarApprovalEmailProps {
  carDetails: { make: string; model: string; year: number; registration?: string }; // Added optional registration
  status: CarApprovalStatus;
  ownerName: string;
  rejectionReason?: string; // Optional: provide a reason for rejection
}

export function renderCarApprovalEmail({
  carDetails,
  status,
  ownerName,
  rejectionReason,
}: CarApprovalEmailProps) {
  const carIdentifier = `${carDetails.make} ${carDetails.model} (${carDetails.year})${carDetails.registration ? ` - ${carDetails.registration}` : ""}`;
  let subject: string;
  let mainHeading: string;
  let messageBody: JSX.Element;

  const previewText = `Update on your vehicle: ${carIdentifier}`;

  switch (status) {
    case CarApprovalStatus.APPROVED:
      subject = `Your Vehicle ${carIdentifier} Has Been Approved!`;
      mainHeading = "Vehicle Approved!";
      messageBody = (
        <>
          <Text className="mb-3">
            Great news! Your vehicle, <span className="font-semibold">{carIdentifier}</span>, has
            been reviewed and approved by our admin team.
          </Text>
          <Text className="mb-3">
            It is now eligible to be listed on our platform. You can manage your vehicle through
            your dashboard.
          </Text>
        </>
      );
      break;
    case CarApprovalStatus.REJECTED:
      subject = `Action Required: Update on Your Vehicle ${carIdentifier}`;
      mainHeading = "Vehicle Submission Update";
      messageBody = (
        <>
          <Text className="mb-3">
            Thank you for submitting your vehicle,{" "}
            <span className="font-semibold">{carIdentifier}</span>, for review.
          </Text>
          <Text className="mb-3">
            Unfortunately, after careful review, your vehicle submission has been rejected by our
            admin team at this time.
          </Text>
          {rejectionReason && (
            <Section className="my-3 p-3 border border-gray-200 rounded-md bg-gray-50">
              <Text className="font-semibold m-0">Reason for rejection:</Text>
              <Text className="m-0">{rejectionReason}</Text>
            </Section>
          )}
          <Text className="mb-3">
            Please review our vehicle guidelines or contact our support team for more information
            and assistance. You may be able to resubmit your vehicle after addressing the issues.
          </Text>
          {/* It's good practice to provide a direct link to support or guidelines */}
          <Text>
            Contact support:{" "}
            <Link
              href={`mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`}
              className="text-blue-600 underline"
            >
              {process.env.SUPPORT_EMAIL || "support@example.com"}
            </Link>
          </Text>
        </>
      );
      break;
    default: // PENDING or other statuses
      subject = `Your Vehicle ${carIdentifier} is Under Review`;
      mainHeading = "Vehicle Under Review";
      messageBody = (
        <Text className="mb-3">
          Your vehicle, <span className="font-semibold">{carIdentifier}</span>, is currently under
          review by our admin team. We will notify you once the review process is complete.
        </Text>
      );
  }

  return render(
    <EmailTemplate previewText={previewText} pageTitle={subject}>
      <Heading as="h2" className="text-xl font-semibold mb-4">
        {mainHeading}
      </Heading>
      <Text className="mb-3">Dear {ownerName},</Text>
      {messageBody}
      <Text className="mt-4">Thank you for being a part of our platform.</Text>
    </EmailTemplate>,
  );
}

// --- Fleet Owner Account Status Email ---
interface FleetOwnerApprovalEmailProps {
  status: FleetOwnerStatus;
  ownerName: string;
  reason?: string; // Optional: for ON_HOLD or REJECTED status
}

export function renderFleetOwnerApprovalEmail({
  status,
  ownerName,
  reason,
}: FleetOwnerApprovalEmailProps) {
  let subject: string;
  let mainHeading: string;
  let messageBody: JSX.Element;
  const previewText = "Update on your Fleet Owner Account";

  switch (status) {
    case FleetOwnerStatus.APPROVED:
      subject = "Congratulations! Your Fleet Owner Account is Approved";
      mainHeading = "Account Approved!";
      messageBody = (
        <>
          <Text className="mb-3">
            We are pleased to inform you that your Fleet Owner account has been approved!
          </Text>
          <Text className="mb-3">
            You can now log in to your dashboard and start adding vehicles to your fleet, manage
            bookings, and access all fleet owner features.
          </Text>
          {/* Optionally, add a direct link to the dashboard */}
          <Link
            href={`${process.env.WEBSITE_URL || process.env.DOMAIN || "https://example.com"}/dashboard`} // Adjust link as needed
            className="text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 py-3 px-5 rounded-md my-4 inline-block"
            style={{ textDecoration: "none" }}
          >
            Go to Dashboard
          </Link>
        </>
      );
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
      mainHeading = "Account On Hold";
      messageBody = (
        <>
          <Text className="mb-3">
            Your Fleet Owner account status has been updated to:{" "}
            <span className="font-semibold">ON HOLD</span>.
          </Text>
          {reason && (
            <Section className="my-3 p-3 border border-gray-200 rounded-md bg-gray-50">
              <Text className="font-semibold m-0">Details:</Text>
              <Text className="m-0">{reason}</Text>
            </Section>
          )}
          <Text className="mb-3">
            This may require further verification or information from your side. Our team may reach
            out to you, or you can contact our support team for more information and to resolve any
            pending issues.
          </Text>
          <Text>
            Contact support:{" "}
            <Link
              href={`mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`}
              className="text-blue-600 underline"
            >
              {process.env.SUPPORT_EMAIL || "support@example.com"}
            </Link>
          </Text>
        </>
      );
      break;
    case FleetOwnerStatus.PROCESSING:
      subject = "Your Fleet Owner Account Application is Being Reviewed";
      mainHeading = "Application Under Review";
      messageBody = (
        <Text className="mb-3">
          Thank you for applying to become a Fleet Owner. Your application is currently under review
          by our team. We will notify you via email as soon as there's an update on your status.
        </Text>
      );
      break;
    default:
      subject = "Update on Your Fleet Owner Account";
      mainHeading = "Account Status Update";
      messageBody = (
        <Text className="mb-3">
          Your Fleet Owner account status has been updated to:{" "}
          <span className="font-semibold">{status.toString().replace("_", " ")}.</span> Please log
          in to your dashboard or contact support for more details.
        </Text>
      );
  }

  return render(
    <EmailTemplate previewText={previewText} pageTitle={subject}>
      <Heading as="h2" className="text-xl font-semibold mb-4">
        {mainHeading}
      </Heading>
      <Text className="mb-3">Dear {ownerName},</Text>
      {messageBody}
      <Text className="mt-4">We appreciate your cooperation.</Text>
    </EmailTemplate>,
  );
}
