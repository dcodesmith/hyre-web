import { Booking, BookingStatus, Car, User } from "@prisma/client";
import { Body, Container, Heading, Hr, Link, Preview, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { match } from "ts-pattern";
import { formatDate } from "~/lib/utils";
import { EmailTemplate } from "./EmailTemplate";

type BookingWithRelations = Booking & {
  car: Car & { owner?: User };
  user: User;
  chauffeur?: User | null;
};

export function renderBookingTemplate(booking: BookingWithRelations) {
  const { title, status } = match(booking.status)
    .with(BookingStatus.CONFIRMED, () => ({
      title: "started",
      status: "active",
    }))
    .with(BookingStatus.ACTIVE, () => ({
      title: "ended",
      status: "completed",
    }))
    .otherwise(() => {
      throw new Error(`Invalid booking status for notification: ${booking.status}`);
    });

  return render(
    <EmailTemplate>
      <Preview>Your booking has {title}</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">Your booking has {title}</Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.user.username || booking.user.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            Your booking for the {booking.car.make} {booking.car.model} is now {status}.
          </Text>

          <Text className="text-base text-gray-800 mt-4">Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Start Date: {booking.startDate.toLocaleDateString()}
            <br />• End Date: {booking.endDate.toLocaleDateString()}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderFleetOwnerBookingCancellationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>A booking has been cancelled</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            A booking has been cancelled
          </Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.car.owner?.username || booking.car.owner?.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            A booking for your {booking.car.make} {booking.car.model} has been cancelled by{" "}
            {booking.user.name || booking.user.email}.
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            The booking amount was{" "}
            <span className="font-semibold">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(Number(booking.totalAmount))}
            </span>
          </Text>

          {booking.cancellationReason && (
            <Text className="text-base text-gray-800 mt-4">
              Reason for cancellation: {booking.cancellationReason}
            </Text>
          )}

          <Text className="text-base text-gray-800 mt-4">Cancelled Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Customer: {booking.user.name || booking.user.email}
            <br />• Start Date & Time: {formatDate(booking.startDate)}
            <br />• End Date & Time: {formatDate(booking.endDate)}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderBookingCancellationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>Your booking has been cancelled</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            Your booking has been cancelled
          </Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.user.username || booking.user.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            Your booking for the {booking.car.make} {booking.car.model} has been cancelled. Your
            payment of{" "}
            <span className="font-semibold">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(Number(booking.totalAmount))}
            </span>{" "}
            will be refunded shortly.
          </Text>

          {booking.cancellationReason && (
            <Text className="text-base text-gray-800 mt-4">
              Reason for cancellation: {booking.cancellationReason}
            </Text>
          )}

          <Text className="text-base text-gray-800 mt-4">Cancelled Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Start Date & Time: {formatDate(booking.startDate)}
            <br />• End Date & Time: {formatDate(booking.endDate)}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderBookingConfirmationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>Your booking has been confirmed</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            Your booking has been confirmed
          </Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.user.username || booking.user.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            Your booking for the {booking.car.make} {booking.car.model} has been confirmed. Here are
            your booking details:
          </Text>

          <Text className="text-base text-gray-800 mt-4">Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Start Date & Time: {formatDate(booking.startDate)}
            <br />• End Date & Time: {formatDate(booking.endDate)}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
            <br />• Pickup Location: {booking.pickupLocation}
            <br />• Drop-off Location: {booking.returnLocation}
            <br />• Total Amount:{" "}
            {new Intl.NumberFormat("en-NG", {
              style: "currency",
              currency: "NGN",
            }).format(Number(booking.totalAmount))}
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            Please be at the pickup location on time. You&apos;ll be assigned a chauffeur shortly.
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderFleetOwnerBookingNotificationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>New Booking Alert - Action Required</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            New Booking Alert - Action Required
          </Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.car.owner?.username || booking.car.owner?.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            A new booking has been made for your {booking.car.make} {booking.car.model}. Please{" "}
            <Link
              href={`${process.env.DOMAIN}/fleet-owner/bookings/${
                booking.id
              }?startDate=${booking.startDate.toISOString()}`}
            >
              assign a chauffeur
            </Link>{" "}
            for this booking as soon as possible.
          </Text>

          <Text className="text-base text-gray-800 mt-4">Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Customer: {booking.user.username || booking.user.email}
            <br />• Start Date & Time: {formatDate(booking.startDate)}
            <br />• End Date & Time: {formatDate(booking.endDate)}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
            <br />• Pickup Location: {booking.pickupLocation}
            <br />• Drop-off Location: {booking.returnLocation}
            <br />• Total Amount:{" "}
            {new Intl.NumberFormat("en-NG", {
              style: "currency",
              currency: "NGN",
            }).format(Number(booking.totalAmount))}
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderChauffeurAssignedEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>A chauffeur has been assigned to your booking</Preview>
      <Body className="bg-white">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium text-gray-800">
            A chauffeur has been assigned to your booking
          </Heading>

          <Text className="text-base text-gray-800">
            Hello {booking.user.username || booking.user.email},
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            A chauffeur has been assigned to your booking for the {booking.car.make}{" "}
            {booking.car.model}. Your chauffeur&apos;s details are below.
          </Text>

          <Text className="text-base text-gray-800 mt-4">Chauffeur Details:</Text>

          <Text className="text-base text-gray-800">
            • Name: {booking?.chauffeur?.name}
            <br />• Email: {booking?.chauffeur?.email}
            {booking?.chauffeur?.phoneNumber && (
              <>
                <br />• Phone: {booking?.chauffeur?.phoneNumber}
              </>
            )}
          </Text>

          <Text className="text-base text-gray-800 mt-4">Booking Details:</Text>

          <Text className="text-base text-gray-800">
            • Start Date & Time: {formatDate(booking.startDate)}
            <br />• End Date & Time: {formatDate(booking.endDate)}
            <br />• Car: {booking.car.make} {booking.car.model} ({booking.car.year})
            <br />• Pickup Location: {booking.pickupLocation}
            <br />• Return Location: {booking.returnLocation}
            <br />• Total Amount:{" "}
            {new Intl.NumberFormat("en-NG", {
              style: "currency",
              currency: "NGN",
            }).format(Number(booking.totalAmount))}
          </Text>

          <Text className="text-base text-gray-800 mt-4">
            Your chauffeur will contact you before the pickup time. If you have any questions,
            please don&apos;t hesitate to reach out to us.
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderBookingReminder(
  booking: BookingWithRelations,
  recipient: "client" | "chauffeur",
  isStartReminder = true,
) {
  const user = recipient === "client" ? booking.user : booking.chauffeur;

  return render(
    <EmailTemplate>
      <Preview>
        This is a reminder that your booking {isStartReminder ? "starts" : "ends"} in 1 hour.
      </Preview>
      <Body className="bg-white text-gray-800">
        <Container className="mx-auto py-4">
          <Text>Hello {user?.name},</Text>

          <Text className="mt-4">
            <strong>Booking Details:</strong>
            <p>Start Date & Time: {formatDate(booking.startDate)}</p>
            <p>End Date & Time: {formatDate(booking.endDate)}</p>
            <p>Pickup Location: {booking.pickupLocation}</p>
            <p>Drop-off Location: {booking.returnLocation}</p>
            <p>
              Car: {booking.car.make} {booking.car.model} ({booking.car.year})
            </p>
          </Text>

          {recipient === "client" && booking.chauffeur && (
            <Text>
              Your chauffeur {booking.chauffeur.name} will{" "}
              {isStartReminder
                ? "meet you at the pickup location"
                : "drop you off at the drop-off location"}
              .
            </Text>
          )}
          {recipient === "chauffeur" && (
            <Text>
              Your client {booking.user.name} will{" "}
              {isStartReminder
                ? "meet you at the pickup location"
                : "drop you off at the drop-off location"}
              .
            </Text>
          )}

          <Hr className="my-4 border-gray-500" />

          <Text className="text-sm text-gray-800">{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}
