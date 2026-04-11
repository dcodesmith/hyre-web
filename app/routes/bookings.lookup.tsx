import { PaymentStatus } from "@prisma/client";
import { type ActionFunctionArgs, data, redirect } from "react-router";
import { prisma } from "~/modules/db/db.server";
import {
  clearGuestBookingLookup,
  normalizeGuestLookupBookingReference,
  normalizeGuestLookupEmail,
  setGuestBookingLookup,
} from "~/services/guest-booking-lookup-session.server";
import { validateCSRF } from "~/utils/csrf-action.server";

const GUEST_LOOKUP_ELIGIBLE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const email = formData.get("email");
  const bookingReference = formData.get("bookingReference");
  const normalizedEmail = typeof email === "string" ? normalizeGuestLookupEmail(email) : "";
  const normalizedBookingReference =
    typeof bookingReference === "string"
      ? normalizeGuestLookupBookingReference(bookingReference)
      : "";

  if (!normalizedEmail || !normalizedBookingReference) {
    return redirect("/bookings?status=confirmed", {
      headers: {
        "Set-Cookie": await clearGuestBookingLookup(request),
      },
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingReference: normalizedBookingReference },
    select: {
      id: true,
      bookingReference: true,
      paymentStatus: true,
      status: true,
      guestUser: true,
    },
  });

  const guestEmail =
    booking?.guestUser &&
    typeof booking.guestUser === "object" &&
    typeof (booking.guestUser as { email?: unknown }).email === "string"
      ? normalizeGuestLookupEmail((booking.guestUser as { email: string }).email)
      : null;

  const hasValidPaymentStatus = booking
    ? GUEST_LOOKUP_ELIGIBLE_PAYMENT_STATUSES.includes(booking.paymentStatus)
    : false;

  if (!booking || guestEmail !== normalizedEmail || !hasValidPaymentStatus) {
    return redirect("/bookings?status=confirmed", {
      headers: {
        "Set-Cookie": await clearGuestBookingLookup(request),
      },
    });
  }

  return redirect(`/bookings?status=${booking.status.toLowerCase()}`, {
    headers: {
      "Set-Cookie": await setGuestBookingLookup(request, {
        email: normalizedEmail,
        bookingReference: booking.bookingReference,
        bookingId: booking.id,
      }),
    },
  });
}

export async function loader() {
  return redirect("/bookings");
}
