import { Button, Heading, Hr, Link, Section, Text, render } from "react-email";
import { NormalisedBookingDetails, NormalisedExtensionDetails } from "~/lib/utils";
import { getEmailPublicEnv } from "../email-public-env";
import { EmailTemplate } from "./EmailTemplate";

function BookingRouteBlock({ booking }: { readonly booking: NormalisedBookingDetails }) {
  return (
    <Section className="px-5 py-4">
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        className="border-collapse"
      >
        <tbody>
          <tr>
            <td width="20" valign="top" align="center" className="w-[20px] p-0 align-top">
              <table
                width="20"
                cellPadding={0}
                cellSpacing={0}
                role="presentation"
                className="w-[20px]"
              >
                <tbody>
                  <tr>
                    <td align="center" className="h-[14px] p-0 leading-[10px]">
                      <div className="mx-auto mt-[2px] h-[10px] w-[10px] rounded-full bg-[#0B0B0F]" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" className="h-full p-0">
                      <div className="mx-auto -mb-px h-full min-h-[65px] w-[2px] bg-[#D8D8DC]" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td valign="top" className="align-top pl-[14px] pb-[14px]">
              <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0 leading-[14px]">
                From
              </Text>
              <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
                {booking.pickupLocation}
              </Text>
            </td>
          </tr>
          <tr>
            <td width="20" valign="top" align="center" className="w-[20px] p-0 align-top">
              <table
                width="20"
                cellPadding={0}
                cellSpacing={0}
                role="presentation"
                className="w-[20px]"
              >
                <tbody>
                  <tr>
                    <td align="center" className="h-[4px] p-0 leading-[4px]">
                      <div className="mx-auto mt-[-1px] h-[4px] w-[2px] bg-[#D8D8DC]" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" className="h-[12px] p-0 leading-[10px]">
                      <div className="mx-auto h-[10px] w-[10px] rounded-full bg-[#0B0B0F]" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td valign="top" className="align-top pl-[14px]">
              <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0 leading-[14px]">
                To
              </Text>
              <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
                {booking.returnLocation}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

type BookingTripCardProps = {
  readonly booking: NormalisedBookingDetails;
  readonly vehicleDescription: string;
  readonly amountLabel?: string;
  readonly extraSection?: JSX.Element;
};

function BookingTripCard({
  booking,
  vehicleDescription,
  amountLabel = "Total",
  extraSection,
}: BookingTripCardProps) {
  return (
    <Section className="mt-6 border border-solid border-[#E6E6E8] rounded-[14px] overflow-hidden">
      <Section className="px-5 pt-5 pb-4">
        <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
          Pickup
        </Text>
        <Text className="text-[18px] leading-[24px] font-bold text-[#0B0B0F] m-0 mt-1">
          {booking.startDate}
        </Text>
        <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">
          Drop-off &middot; {booking.endDate}
        </Text>
      </Section>

      <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
      <BookingRouteBlock booking={booking} />

      <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
      <Section className="px-5 py-4">
        <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
          Vehicle
        </Text>
        <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
          {booking.carName}
        </Text>
        <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">
          {vehicleDescription}
        </Text>
      </Section>

      {extraSection && (
        <>
          <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
          <Section className="px-5 py-4">{extraSection}</Section>
        </>
      )}

      <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
      <Section className="px-5 py-4 bg-[#FAFAFB]">
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tr>
            <td>
              <Text className="text-[13px] text-[#6A6A71] m-0">{amountLabel}</Text>
            </td>
            <td align="right">
              <Text className="text-[16px] font-extrabold text-[#0B0B0F] m-0">
                {booking.totalAmount}
              </Text>
            </td>
          </tr>
          <tr>
            <td>
              <Text className="text-[11px] text-[#9A9A9F] m-0 mt-1">
                Ref {booking.bookingReference}
              </Text>
            </td>
            <td />
          </tr>
        </table>
      </Section>
    </Section>
  );
}

// --- Booking Status Update Email ---
export function BookingStatusUpdateEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const { domain } = getEmailPublicEnv();
  const firstName = booking.customerName.split(" ")[0] || booking.customerName;
  const bookingUrl = domain && domain !== "#" ? `${domain}/bookings/${booking.id}` : undefined;
  const previewText = `Your booking has ${booking.title}`;

  return (
    <EmailTemplate previewText={previewText} pageTitle={`Booking ${booking.status}`}>
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Booking update
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Hi {firstName}, your trip is {booking.status}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Your booking for the <span className="font-semibold">{booking.carName}</span> has{" "}
        {booking.title}.
      </Text>

      <BookingTripCard
        booking={booking}
        vehicleDescription="We'll keep you posted as your ride progresses."
      />

      {bookingUrl && (
        <Section className="mt-6 text-center">
          <Button
            href={bookingUrl}
            className="bg-[#0B0B0F] text-white rounded-[10px] px-6 py-3 text-[14px] font-semibold no-underline inline-block"
          >
            View booking
          </Button>
        </Section>
      )}
    </EmailTemplate>
  );
}

export function renderBookingStatusUpdateEmail(booking: NormalisedBookingDetails) {
  return render(<BookingStatusUpdateEmail booking={booking} />);
}

// --- Fleet Owner: Booking Cancellation Email ---
export function FleetOwnerBookingCancellationEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const firstName = booking.ownerName.split(" ")[0] || booking.ownerName;
  const previewText = "A booking for your vehicle has been cancelled";

  return (
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Notification">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Fleet update
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Booking cancelled, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        The booking for your <span className="font-semibold">{booking.carName}</span> has been
        cancelled by {booking.customerName}.
      </Text>

      <BookingTripCard
        booking={booking}
        amountLabel="Booking amount"
        vehicleDescription="This trip slot is now open and can accept a new booking."
        extraSection={
          <>
            <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
              Cancellation reason
            </Text>
            <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
              {booking.cancellationReason}
            </Text>
          </>
        }
      />
    </EmailTemplate>
  );
}

export function renderFleetOwnerBookingCancellationEmail(booking: NormalisedBookingDetails) {
  return render(<FleetOwnerBookingCancellationEmail booking={booking} />);
}

// --- User: Booking Cancellation Email ---
export function UserBookingCancellationEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const firstName = booking.customerName.split(" ")[0] || booking.customerName;
  const previewText = "Your booking has been cancelled";

  return (
    <EmailTemplate previewText={previewText} pageTitle="Booking Cancellation Confirmation">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Booking cancelled
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        We&apos;ve cancelled your trip, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Your booking for the <span className="font-semibold">{booking.carName}</span> has been
        cancelled.
      </Text>

      <Text className="text-[14px] leading-[20px] text-[#4A4A52] mt-3 mb-0">
        Your payment of <span className="font-semibold">{booking.totalAmount}</span> will be
        refunded shortly according to our policy.
      </Text>

      <BookingTripCard
        booking={booking}
        vehicleDescription="If you'd like to travel at a different time, you can make a new booking anytime."
        extraSection={
          <>
            <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
              Cancellation reason
            </Text>
            <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
              {booking.cancellationReason}
            </Text>
          </>
        }
      />
    </EmailTemplate>
  );
}

export function renderUserBookingCancellationEmail(booking: NormalisedBookingDetails) {
  return render(<UserBookingCancellationEmail booking={booking} />);
}

// --- User: Booking Confirmation Email ---
export function BookingConfirmationEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const { domain } = getEmailPublicEnv();
  const firstName = booking.customerName.split(" ")[0] || booking.customerName;
  const bookingUrl = domain && domain !== "#" ? `${domain}/bookings/${booking.id}` : undefined;
  const previewText = `Your ride is booked for ${booking.startDate}`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Booking confirmed">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Trip confirmed
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        See you soon, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Your ride in the <span className="font-semibold text-[#0B0B0F]">{booking.carName}</span> is
        all set. Here are the details for your trip.
      </Text>

      <BookingTripCard
        booking={booking}
        vehicleDescription="A chauffeur will be assigned and introduced before your pickup."
      />

      {/* CTA */}
      {bookingUrl && (
        <Section className="mt-6 text-center">
          <Button
            href={bookingUrl}
            className="bg-[#0B0B0F] text-white rounded-[10px] px-6 py-3 text-[14px] font-semibold no-underline inline-block"
          >
            Manage booking
          </Button>
        </Section>
      )}

      <Text className="text-[13px] leading-[18px] text-[#6A6A71] mt-6 mb-0">
        Please be ready at the pickup location on time. We&apos;ll email you again as soon as your
        chauffeur is assigned.
      </Text>

      <Hr className="my-6 border-t border-solid border-[#EFEFF1]" />

      <Text className="text-[12px] leading-[18px] text-[#9A9A9F] m-0">
        Need to make a change? Reply to this email or{" "}
        {bookingUrl ? (
          <Link href={bookingUrl} className="text-[#0B0B0F] font-medium underline">
            manage your booking online
          </Link>
        ) : (
          <span>manage your booking online</span>
        )}
        .
      </Text>
    </EmailTemplate>
  );
}

export function renderBookingConfirmationEmail(booking: NormalisedBookingDetails) {
  return render(<BookingConfirmationEmail booking={booking} />);
}

// --- Fleet Owner: New Booking Notification Email ---
export function FleetOwnerBookingNotificationEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const firstName = booking.ownerName.split(" ")[0] || booking.ownerName;
  const previewText = "New Booking Alert - Action Required";
  const { domain } = getEmailPublicEnv();
  const bookingLink =
    domain && domain !== "#"
      ? `${domain}/fleet-owner/bookings/${booking.id}?startDate=${encodeURIComponent(
          booking.startDate,
        )}`
      : undefined;

  return (
    <EmailTemplate previewText={previewText} pageTitle="New Booking Notification">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        New booking
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Assign a chauffeur, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        A new booking has been made for your{" "}
        <span className="font-semibold">{booking.carName}</span>. Please assign a chauffeur to
        confirm operations.
      </Text>

      <BookingTripCard
        booking={booking}
        vehicleDescription={`Customer: ${booking.customerName}`}
        extraSection={
          <>
            <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
              Action required
            </Text>
            <Text className="text-[14px] leading-[20px] text-[#0B0B0F] m-0 mt-1">
              Assign a chauffeur to this trip so the customer receives final travel details.
            </Text>
          </>
        }
      />

      {bookingLink && (
        <Section className="mt-6 text-center">
          <Button
            href={bookingLink}
            className="bg-[#0B0B0F] text-white rounded-[10px] px-6 py-3 text-[14px] font-semibold no-underline inline-block"
          >
            Assign chauffeur
          </Button>
        </Section>
      )}
    </EmailTemplate>
  );
}

export function renderFleetOwnerBookingNotificationEmail(booking: NormalisedBookingDetails) {
  return render(<FleetOwnerBookingNotificationEmail booking={booking} />);
}

// --- User: Chauffeur Assigned Email ---
export function ChauffeurAssignedEmail({
  booking,
}: { readonly booking: NormalisedBookingDetails }) {
  const firstName = booking.customerName.split(" ")[0] || booking.customerName;
  const previewText = "A chauffeur has been assigned to your booking";

  return (
    <EmailTemplate previewText={previewText} pageTitle="Chauffeur Assigned">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Chauffeur assigned
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Your driver is ready, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        A chauffeur has been assigned to your booking for the{" "}
        <span className="font-semibold">{booking.carName}</span>.
      </Text>

      <BookingTripCard
        booking={booking}
        vehicleDescription="Your chauffeur will contact you ahead of pickup."
        extraSection={
          <>
            <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
              Chauffeur details
            </Text>
            <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
              {booking.chauffeurName}
            </Text>
            {booking.chauffeurPhoneNumber && (
              <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">
                {booking.chauffeurPhoneNumber}
              </Text>
            )}
          </>
        }
      />

      <Text className="text-[13px] leading-[18px] text-[#6A6A71] mt-6 mb-0">
        Your chauffeur will contact you before the pickup time. If you have any questions, please
        don't hesitate to contact us.
      </Text>
    </EmailTemplate>
  );
}

export function renderChauffeurAssignedEmail(booking: NormalisedBookingDetails) {
  return render(<ChauffeurAssignedEmail booking={booking} />);
}

export function BookingExtensionConfirmationEmail({
  extension,
}: { readonly extension: NormalisedExtensionDetails }) {
  const firstName = extension.customerName.split(" ")[0] || extension.customerName;
  const previewText = "Your booking has been extended";

  return (
    <EmailTemplate previewText={previewText} pageTitle="Booking Extension Confirmation">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Trip extension
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Your trip was extended, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Your booking for <span className="font-semibold">{extension.carName}</span> on{" "}
        {extension.legDate} has been extended for{" "}
        {extension.extensionHours === 1 ? "1 hour" : `${extension.extensionHours} hours`} from{" "}
        {extension.from} to {extension.to}
      </Text>

      <Section className="mt-6 border border-solid border-[#E6E6E8] rounded-[14px] overflow-hidden">
        <Section className="px-5 py-4">
          <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
            Updated timeline
          </Text>
          <Text className="text-[18px] leading-[24px] font-bold text-[#0B0B0F] m-0 mt-1">
            {extension.from} - {extension.to}
          </Text>
          <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">
            {extension.extensionHours === 1
              ? "Extension duration: 1 hour"
              : `Extension duration: ${extension.extensionHours} hours`}
          </Text>
        </Section>
        <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
        <Section className="px-5 py-4 bg-[#FAFAFB]">
          <Text className="text-[13px] text-[#6A6A71] m-0">Date</Text>
          <Text className="text-[14px] leading-[20px] font-semibold text-[#0B0B0F] m-0 mt-1">
            {extension.legDate}
          </Text>
        </Section>
      </Section>
    </EmailTemplate>
  );
}

export function bookingExtensionConfirmationEmail(extension: NormalisedExtensionDetails) {
  return render(<BookingExtensionConfirmationEmail extension={extension} />);
}
