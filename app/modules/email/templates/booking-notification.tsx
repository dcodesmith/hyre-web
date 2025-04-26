import { Booking, BookingStatus, Car, User } from "@prisma/client";
import {
  Body,
  Container,
  Heading,
  Hr,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { match } from "ts-pattern";
import { formatDate } from "~/lib/utils";
import { EmailTemplate } from "./EmailTemplate";

type BookingWithRelations = Booking & {
  car: Car & { owner?: User };
  user: User | null;
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
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">Your booking has {title}</Heading>

          <Text>
            Hello {booking.user?.username || booking.guestUser?.name || booking.guestUser?.email},
          </Text>

          <Text className="mt-4">
            Your booking for the{" "}
            <span className="font-semibold">
              {booking.car.make} {booking.car.model} ({booking.car.year})
            </span>{" "}
            is now {status}.
          </Text>

          <Text className="mt-4">Booking Details:</Text>

          <Text>
            <ul className="list-none p-0">
              <li className="m-0">Start Date: {booking.startDate.toLocaleDateString()}</li>
              <li className="m-0">End Date: {booking.endDate.toLocaleDateString()}</li>
            </ul>
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderFleetOwnerBookingCancellationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>A booking has been cancelled</Preview>
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">A booking has been cancelled</Heading>

          <Text>Hello {booking.car.owner?.username || booking.car.owner?.email},</Text>

          <Text className="mt-4">
            The booking for your{" "}
            <span className="font-semibold">
              {booking.car.make} {booking.car.model} ({booking.car.year})
            </span>{" "}
            has been cancelled by{" "}
            {booking.user?.name || booking.guestUser?.name || booking.guestUser?.email}.
          </Text>

          <Text className="mt-4">
            The booking amount was{" "}
            <span className="font-semibold">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(Number(booking.totalAmount))}
            </span>
          </Text>

          {booking.cancellationReason && (
            <Text className="mt-4">Reason for cancellation: {booking.cancellationReason}</Text>
          )}

          <Text className="mt-4">Cancelled Booking Details:</Text>

          <Text>
            <ul className="list-none p-0">
              <li className="m-0">
                Customer:{" "}
                {booking.user?.name || booking.guestUser?.name || booking.guestUser?.email}
              </li>
              <li className="m-0">Start Date & Time: {formatDate(booking.startDate)}</li>
              <li className="m-0">End Date & Time: {formatDate(booking.endDate)}</li>
            </ul>
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderBookingCancellationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>Your booking has been cancelled</Preview>
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">Your booking has been cancelled</Heading>

          <Text>
            Hello {booking.user?.username || booking.guestUser?.name || booking.guestUser?.email},
          </Text>

          <Text className="mt-4">
            Your booking for the{" "}
            <span className="font-semibold">
              {booking.car.make} {booking.car.model} ({booking.car.year})
            </span>{" "}
            has been cancelled. Your payment of{" "}
            <span className="font-semibold">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
              }).format(Number(booking.totalAmount))}
            </span>{" "}
            will be refunded shortly.
          </Text>

          {booking.cancellationReason && (
            <Text className="mt-4">Reason for cancellation: {booking.cancellationReason}</Text>
          )}

          <Text className="mt-4">Cancelled Booking Details:</Text>

          <Text>
            <ul className="list-none p-0">
              <li className="m-0">Start Date & Time: {formatDate(booking.startDate)}</li>
              <li className="m-0">End Date & Time: {formatDate(booking.endDate)}</li>
            </ul>
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderBookingConfirmationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>Your booking has been confirmed</Preview>
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">Your booking has been confirmed</Heading>

          <Text>
            Hello {booking.user?.username || booking.guestUser?.name || booking.guestUser?.email},
          </Text>

          <Text className="mt-4">
            Your booking for the{" "}
            <span className="font-semibold">
              {booking.car.make} {booking.car.model} ({booking.car.year})
            </span>{" "}
            has been confirmed.
          </Text>

          <Section className="border-t border-gray-300">
            <Text className="font-semibold mt-4">Here are your booking details:</Text>
            <Text>
              <ul className="list-none p-0">
                <li className="m-0">Start Date & Time: {formatDate(booking.startDate)}</li>
                <li className="m-0">End Date & Time: {formatDate(booking.endDate)}</li>
                <li className="m-0">Pickup Location: {booking.pickupLocation}</li>
                <li className="m-0">Drop-off Location: {booking.returnLocation}</li>
                <li className="m-0 font-semibold">
                  Total Amount:{" "}
                  {new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                  }).format(Number(booking.totalAmount))}
                </li>
              </ul>
            </Text>
          </Section>

          <Text className="mt-4">
            Please be at the pickup location on time. You&apos;ll be assigned a chauffeur shortly.
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderFleetOwnerBookingNotificationEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>New Booking Alert - Action Required</Preview>
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">New Booking Alert - Action Required</Heading>

          <Text>Hello {booking.car.owner?.username || booking.car.owner?.email},</Text>

          <Text className="mt-4">
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

          <Section className="mt-4 border-t border-gray-300 pt-4">
            <Text className="font-semibold">Booking Details:</Text>
            <Text>
              <ul className="list-none p-0">
                <li className="m-0">
                  Customer:{" "}
                  {booking.user?.username || booking.guestUser?.name || booking.guestUser?.email}
                </li>
                <li className="m-0">Start Date & Time: {formatDate(booking.startDate)}</li>
                <li className="m-0">End Date & Time: {formatDate(booking.endDate)}</li>
                <li className="m-0">
                  Car: {booking.car.make} {booking.car.model} ({booking.car.year})
                </li>
                <li className="m-0">Pickup Location: {booking.pickupLocation}</li>
                <li className="m-0">Drop-off Location: {booking.returnLocation}</li>
                <li className="m-0">
                  Total Amount:{" "}
                  {new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                  }).format(Number(booking.totalAmount))}
                </li>
              </ul>
            </Text>
          </Section>

          <Text className="mt-4">If you have any questions, feel free to contact us.</Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}

export function renderChauffeurAssignedEmail(booking: BookingWithRelations) {
  return render(
    <EmailTemplate>
      <Preview>A chauffeur has been assigned to your booking</Preview>
      <Body className="bg-white text-gray-800 text-sm">
        <Container className="mx-auto py-4">
          <Heading className="text-2xl font-medium">
            A chauffeur has been assigned to your booking
          </Heading>

          <Text>
            Hello {booking.user?.username || booking.guestUser?.name || booking.guestUser?.email},
          </Text>

          <Text className="mt-4">
            A chauffeur has been assigned to your booking for the {booking.car.make}{" "}
            {booking.car.model}. Your chauffeur&apos;s details are below.
          </Text>

          <Text className="mt-4">Chauffeur Details:</Text>

          <Text>
            <ul className="list-none p-0">
              <li className="m-0">Name: {booking?.chauffeur?.name}</li>
              <li className="m-0">Email: {booking?.chauffeur?.email}</li>
              <li className="m-0">Phone: {booking?.chauffeur?.phoneNumber}</li>
            </ul>
          </Text>

          <Text className="mt-4">Booking Details:</Text>

          <Text>
            <ul className="list-none p-0">
              <li className="m-0">Start Date & Time: {formatDate(booking.startDate)}</li>
              <li className="m-0">End Date & Time: {formatDate(booking.endDate)}</li>
              <li className="m-0">Pickup Location: {booking.pickupLocation}</li>
              <li className="m-0">Return Location: {booking.returnLocation}</li>
              <li className="m-0">
                Total Amount:{" "}
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                }).format(Number(booking.totalAmount))}
              </li>
            </ul>
          </Text>

          <Text className="mt-4">
            Your chauffeur will contact you before the pickup time. If you have any questions,
            please don&apos;t hesitate to reach out to us.
          </Text>

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
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
  const user = recipient === "client" ? (booking.user ?? booking.guestUser) : booking.chauffeur;

  return render(
    <EmailTemplate>
      <Preview>
        This is a reminder that your booking {isStartReminder ? "starts" : "ends"} in 1 hour.
      </Preview>
      <Body className="bg-white text-gray-800 text-sm">
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
              Your client {booking.user?.name || booking.guestUser?.name} will{" "}
              {isStartReminder
                ? "meet you at the pickup location"
                : "drop you off at the drop-off location"}
              .
            </Text>
          )}

          <Hr className="my-4 border-gray-500" />

          <Text>{new Date().getFullYear()}. Lagos, Nigeria</Text>
        </Container>
      </Body>
    </EmailTemplate>,
  );
}
