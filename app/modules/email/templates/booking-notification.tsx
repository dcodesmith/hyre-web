import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { NormalisedBookingDetails, NormalisedExtensionDetails } from "~/lib/utils";
import { EmailTemplate } from "./EmailTemplate";

function DetailListItem({
  label,
  value,
  isCurrency = false,
  currencyCode = "NGN",
}: {
  label: string;
  value: string | number | undefined | null;
  isCurrency?: boolean;
  currencyCode?: string;
}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  let displayValue: string | number = value;

  if (isCurrency) {
    displayValue = new Intl.NumberFormat("en-NG", {
      // Consider making locale dynamic if needed
      style: "currency",
      currency: currencyCode,
    }).format(Number(value));
  }

  return (
    <Text className="m-0 py-1">
      {" "}
      {/* Adjusted to text-sm for potentially long lists */}
      <span className="font-semibold">{label}:</span> {displayValue}
    </Text>
  );
}

// --- Booking Status Update Email ---
export function renderBookingStatusUpdateEmail(booking: NormalisedBookingDetails) {
  const previewText = `Your booking has ${booking.title}`;

  return render(
    <EmailTemplate previewText={previewText} pageTitle={`Booking ${booking.title}`}>
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking {booking.title}
      </Heading>
      <Text className="mb-3">Hello {booking.customerName},</Text>
      <Text className="mb-3">
        Your booking for the <span className="font-semibold">{booking.carName}</span> has{" "}
        {booking.title} and is now {booking.status}.
      </Text>
      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">
          Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Start Date" value={booking.startDate} />
        <DetailListItem label="End Date" value={booking.endDate} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount} />
      </Section>
    </EmailTemplate>,
  );
}

// --- Fleet Owner: Booking Cancellation Email ---
export function renderFleetOwnerBookingCancellationEmail(booking: NormalisedBookingDetails) {
  const ownerName = booking.ownerName;
  const customerName = booking.customerName;
  const previewText = "A booking for your vehicle has been cancelled";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Notification">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Cancelled
      </Heading>
      <Text className="mb-3">Hello {ownerName},</Text>

      <Text className="mb-3">
        The booking for your vehicle, <span className="font-semibold">{booking.carName}</span>, has
        been cancelled by {customerName}.
      </Text>
      <DetailListItem label="Reason for cancellation" value={booking.cancellationReason} />

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">
          Cancelled Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Customer" value={customerName} />
        <DetailListItem label="Start Date & Time" value={booking.startDate} />
        <DetailListItem label="End Date & Time" value={booking.endDate} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <DetailListItem label="Booking Amount" value={booking.totalAmount} />
      </Section>
    </EmailTemplate>,
  );
}

// --- User: Booking Cancellation Email ---
export function renderUserBookingCancellationEmail(booking: NormalisedBookingDetails) {
  const customerName = booking.customerName;
  const previewText = "Your booking has been cancelled";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Confirmation">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Your Booking Has Been Cancelled
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>

      <Text className="mb-3">
        Your booking for the <span className="font-semibold">{booking.carName}</span> has been
        cancelled.
      </Text>

      <Text className="mb-3">
        Your payment of <span className="font-semibold">{booking.totalAmount}</span> will be
        refunded shortly according to our policy.
      </Text>

      <Text className="mt-3">
        <span className="font-semibold">Reason for cancellation:</span> {booking.cancellationReason}
      </Text>

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">
          Cancelled Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Start Date & Time" value={booking.startDate} />
        <DetailListItem label="End Date & Time" value={booking.endDate} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
      </Section>
    </EmailTemplate>,
  );
}

// --- User: Booking Confirmation Email ---
export function renderBookingConfirmationEmail(booking: NormalisedBookingDetails) {
  const customerName = booking.customerName;
  const carName = booking.carName;
  const previewText = "Your booking is confirmed!";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Confirmation">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Confirmed!
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        Your booking for the <span className="font-semibold">{carName}</span> has been confirmed.
      </Text>
      <Section className="border border-gray-200 rounded-md p-4 bg-gray-50">
        <Text className="font-semibold mb-2 underline">
          Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Start Date & Time" value={booking.startDate} />
        <DetailListItem label="End Date & Time" value={booking.endDate} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount} />
      </Section>
      <Text className="mb-3">
        Please be at the pickup location on time. You'll be assigned a chauffeur shortly, and we
        will notify you with their details.
      </Text>
    </EmailTemplate>,
  );
}

// --- Fleet Owner: New Booking Notification Email ---
export function renderFleetOwnerBookingNotificationEmail(booking: NormalisedBookingDetails) {
  const ownerName = booking.ownerName;
  const customerName = booking.customerName;
  const carName = booking.carName;
  const previewText = "New Booking Alert - Action Required";
  const bookingLink = `${process.env.DOMAIN}/fleet-owner/bookings/${booking.id}?startDate=${encodeURIComponent(
    booking.startDate,
  )}`;

  return render(
    <EmailTemplate previewText={previewText} pageTitle="New Booking Notification">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        New Booking Alert - Action Required
      </Heading>
      <Text className="mb-3">Hello {ownerName},</Text>
      <Text className="mb-3">
        A new booking has been made for your {carName}. Please{" "}
        <Link href={bookingLink} className="text-blue-600 underline">
          assign a chauffeur
        </Link>{" "}
        for this booking as soon as possible.
      </Text>
      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">
          Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Customer" value={customerName} />
        <DetailListItem label="Start Date & Time" value={booking.startDate} />
        <DetailListItem label="End Date & Time" value={booking.endDate} />
        <DetailListItem label="Car" value={carName} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount} />
      </Section>
      <Text className="mt-4">If you have any questions, feel free to contact us.</Text>
    </EmailTemplate>,
  );
}

// --- User: Chauffeur Assigned Email ---
export function renderChauffeurAssignedEmail(booking: NormalisedBookingDetails) {
  const customerName = booking.customerName;
  const carName = booking.carName;
  const chauffeurName = booking.chauffeurName;
  const previewText = "A chauffeur has been assigned to your booking";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Chauffeur Assigned">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Chauffeur Assigned to Your Booking
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        A chauffeur has been assigned to your booking for the {carName}. Your chauffeur's details
        are below.
      </Text>
      <Section className="border border-gray-200 rounded-md p-4 my-4 bg-gray-50">
        {chauffeurName && (
          <>
            <Text className="font-semibold mb-2 underline">Chauffeur Details</Text>
            <DetailListItem label="Name" value={chauffeurName} />
            {booking.chauffeurPhoneNumber && (
              <DetailListItem label="Phone" value={booking.chauffeurPhoneNumber} />
            )}
          </>
        )}
        <Text className="font-semibold mb-2 underline">
          Booking Details (Booking Reference: {booking.bookingReference})
        </Text>
        <DetailListItem label="Start Date & Time" value={booking.startDate} />
        <DetailListItem label="End Date & Time" value={booking.endDate} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Return Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount} />
      </Section>
      <Text className="mt-4">
        Your chauffeur will contact you before the pickup time. If you have any questions, please
        don't hesitate to contact us.
      </Text>
    </EmailTemplate>,
  );
}

export function bookingExtensionConfirmationEmail(extension: NormalisedExtensionDetails) {
  const customerName = extension.customerName;
  const carName = extension.carName;
  const previewText = "Your booking has been extended";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Extension Confirmation">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Extension Confirmation
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        Your booking for the {carName} today, {extension.legDate} has been extended for{" "}
        {extension.extensionHours} hours from {extension.from} to {extension.to}
      </Text>
    </EmailTemplate>,
  );
}
