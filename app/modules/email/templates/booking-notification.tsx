import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { match } from "ts-pattern";
import { formatDate } from "~/lib/utils";
import { EmailTemplate } from "./EmailTemplate";
import { DetailListItem, getUserDisplayName } from "./EmailShared";
import { BookingStatus } from "@prisma/client";
import { format } from "date-fns";
import { BookingWithRelations } from "~/types";

// --- Booking Status Update Email ---
export function renderBookingStatusUpdateEmail(booking: BookingWithRelations) {
  const { title, status } = match(booking.status)
    .with(BookingStatus.CONFIRMED, () => ({ title: "started", status: "active" }))
    .with(BookingStatus.ACTIVE, () => ({ title: "ended", status: "completed" }))
    .otherwise(() => ({
      title: `status is ${booking.status.toLowerCase()}`,
      status: booking.status.toLowerCase(),
    }));

  const customerName = getUserDisplayName(booking, "user");
  const previewText = `Your booking has ${title}`;

  return render(
    <EmailTemplate previewText={previewText} pageTitle={`Booking ${title}`}>
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking {title}
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        Your booking for the{" "}
        <span className="font-semibold">
          {booking.car.make} {booking.car.model} ({booking.car.year})
        </span>{" "}
        has {title} and is now {status}.
      </Text>
      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">Booking Details</Text>
        <DetailListItem label="Start Date" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount.toString()} isCurrency />
      </Section>
    </EmailTemplate>,
  );
}

// --- Fleet Owner: Booking Cancellation Email ---
export function renderFleetOwnerBookingCancellationEmail(booking: BookingWithRelations) {
  const ownerName = getUserDisplayName(booking, "owner");
  const customerName = getUserDisplayName(booking, "user");
  const previewText = "A booking for your vehicle has been cancelled";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Notification">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Cancelled
      </Heading>
      <Text className="mb-3">Hello {ownerName},</Text>
      <Text className="mb-3">
        The booking for your vehicle,{" "}
        <span className="font-semibold">
          {booking.car.make} {booking.car.model} ({booking.car.year})
        </span>
        , has been cancelled by {customerName}.
      </Text>
      <DetailListItem label="Booking Amount" value={booking.totalAmount.toString()} isCurrency />
      {booking.cancellationReason && (
        <Text className="mt-3">
          <span className="font-semibold">Reason for cancellation:</span>{" "}
          {booking.cancellationReason}
        </Text>
      )}
      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">Cancelled Booking Details</Text>
        <DetailListItem label="Customer" value={customerName} />
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
      </Section>
    </EmailTemplate>,
  );
}

// --- User: Booking Cancellation Email ---
export function renderUserBookingCancellationEmail(booking: BookingWithRelations) {
  const customerName = getUserDisplayName(booking, "user");
  const previewText = "Your booking has been cancelled";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Confirmation">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Your Booking Has Been Cancelled
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        Your booking for the{" "}
        <span className="font-semibold">
          {booking.car.make} {booking.car.model} ({booking.car.year})
        </span>{" "}
        has been cancelled.
      </Text>
      <Text className="mb-3">
        Your payment of{" "}
        <span className="font-semibold">
          {new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
          }).format(Number(booking.totalAmount))}
        </span>{" "}
        will be refunded shortly according to our policy.
      </Text>
      {booking.cancellationReason && (
        <Text className="mt-3">
          <span className="font-semibold">Reason for cancellation:</span>{" "}
          {booking.cancellationReason}
        </Text>
      )}
      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">Cancelled Booking Details</Text>
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
      </Section>
    </EmailTemplate>,
  );
}

// --- User: Booking Confirmation Email ---
export function renderBookingConfirmationEmail(booking: BookingWithRelations) {
  const customerName = getUserDisplayName(booking, "user");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;
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
        <Text className="font-semibold mb-2 underline">Booking Details</Text>
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount.toString()} isCurrency />
      </Section>
      <Text className="mb-3">
        Please be at the pickup location on time. You'll be assigned a chauffeur shortly, and we
        will notify you with their details.
      </Text>
    </EmailTemplate>,
  );
}

// --- Fleet Owner: New Booking Notification Email ---
export function renderFleetOwnerBookingNotificationEmail(booking: BookingWithRelations) {
  const ownerName = getUserDisplayName(booking, "owner");
  const customerName = getUserDisplayName(booking, "user");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;
  const previewText = "New Booking Alert - Action Required";
  const bookingLink = `${process.env.DOMAIN}/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate.toISOString()}`;

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
        <Text className="font-semibold mb-2 underline">Booking Details</Text>
        <DetailListItem label="Customer" value={customerName} />
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Car" value={carName} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount.toString()} isCurrency />
      </Section>
      <Text className="mt-4">If you have any questions, feel free to contact us.</Text>
    </EmailTemplate>,
  );
}

// --- User: Chauffeur Assigned Email ---
export function renderChauffeurAssignedEmail(booking: BookingWithRelations) {
  const customerName = getUserDisplayName(booking, "user");
  const carName = `${booking.car.make} ${booking.car.model}`;
  const chauffeurName = getUserDisplayName(booking, "chauffeur");
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
        {booking.chauffeur && (
          <>
            <Text className="font-semibold mb-2 underline">Chauffeur Details</Text>
            <DetailListItem label="Name" value={chauffeurName} />
            <DetailListItem label="Email" value={booking.chauffeur.email} />
            <DetailListItem label="Phone" value={booking.chauffeur.phoneNumber} />
          </>
        )}
        <Text className="font-semibold mb-2 underline">Booking Details</Text>
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Return Location" value={booking.returnLocation} />
        <Hr className="my-2 border-gray-300" />
        <DetailListItem label="Total Amount" value={booking.totalAmount.toString()} isCurrency />
      </Section>
      <Text className="mt-4">
        Your chauffeur will contact you before the pickup time. If you have any questions, please
        don't hesitate to reach out to us.
      </Text>
    </EmailTemplate>,
  );
}

// --- Booking Reminder Email (for Client or Chauffeur) ---
export function renderBookingReminderEmail(
  booking: BookingWithRelations,
  recipientType: "client" | "chauffeur",
  isStartReminder = true,
) {
  const recipientName =
    recipientType === "client"
      ? getUserDisplayName(booking, "user")
      : getUserDisplayName(booking, "chauffeur");

  const reminderAction = isStartReminder ? "starts" : "ends";
  const previewText = `Reminder: Your booking ${reminderAction} in 1 hour.`;
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;

  const latestExtension = booking.extensions?.[booking.extensions.length - 1];
  const endDateToCheck = latestExtension ? latestExtension.endDate : booking.endDate;

  return render(
    <EmailTemplate
      previewText={previewText}
      pageTitle={`Booking ${isStartReminder ? "Start" : "End"} Reminder`}
    >
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Reminder
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>
      <Text className="mb-3">
        This is a friendly reminder that your booking for the {carName} {reminderAction} in
        approximately 1 hour.
      </Text>
      <Section className="border border-gray-200 p-4 bg-gray-50">
        <Text className="font-semibold mb-2 underline">Booking Details</Text>
        <DetailListItem label="Car" value={carName} />
        <DetailListItem label="Start Date & Time" value={formatDate(booking.startDate)} />
        <DetailListItem label="End Date & Time" value={formatDate(booking.endDate)} />
        <DetailListItem label="Pickup Location" value={booking.pickupLocation} />
        <DetailListItem label="Drop-off Location" value={booking.returnLocation} />
      </Section>

      {recipientType === "client" && booking.chauffeur && (
        <Text className="mb-3">
          Your chauffeur, {getUserDisplayName(booking, "chauffeur")}, will{" "}
          {isStartReminder ? "meet you at the pickup location." : "be there for your drop-off."}
        </Text>
      )}
      {recipientType === "chauffeur" && (
        <Text className="mb-3">
          Your client, {getUserDisplayName(booking, "user")}, will{" "}
          {isStartReminder ? "meet you at the pickup location." : "be ready for drop-off."}
        </Text>
      )}

      {recipientType === "client" &&
        !isStartReminder &&
        format(endDateToCheck, "HH:mm") !== "00:00" && (
          <Text className="mt-4 mb-3">
            Want to keep the car longer?{" "}
            <Link
              href={`${process.env.DOMAIN}/bookings/${booking.id}/extend`} // Ensure this link is correct
              className="text-blue-600 underline"
            >
              Extend Booking
            </Link>
          </Text>
        )}
      <Text className="mt-4">Please be prepared for the scheduled time.</Text>
    </EmailTemplate>,
  );
}

export function bookingExtensionConfirmationEmail(booking: BookingWithRelations) {
  const customerName = getUserDisplayName(booking, "user");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;
  const previewText = "Your booking has been extended";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Booking Extension Confirmation">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Booking Extension Confirmation
      </Heading>
      <Text className="mb-3">Hello {customerName},</Text>
      <Text className="mb-3">
        Your booking for the {carName} today, {format(booking.extensions[0].day, "PPPP")} has been
        extended for {booking.extensions[0].hours} hours from{" "}
        {format(booking.extensions[0].originalEndDate, "p")} to{" "}
        {format(booking.extensions[0].endDate, "p")}
      </Text>
    </EmailTemplate>,
  );
}
