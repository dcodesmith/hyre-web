import type { ActionFunctionArgs } from "react-router";
import { isE2ETesting } from "~/modules/auth/otp-test-store.server";
import { activateBooking, findBookingsByPaymentIntent } from "~/services/bookings.server";
import { prisma } from "~/modules/db/db.server";

/**
 * Test-only endpoint that activates a pending booking by its paymentIntent (tx_ref).
 * Simulates what the Flutterwave webhook does after a successful payment.
 * Only available when E2E_TESTING=true.
 *
 * POST /api/test/activate-booking
 * Body: { "txRef": "..." }
 */
export async function action({ request }: ActionFunctionArgs) {
  if (!isE2ETesting() || process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const { txRef } = await request.json();
  if (!txRef) {
    return Response.json({ error: "txRef is required" }, { status: 400 });
  }

  const bookings = await findBookingsByPaymentIntent(txRef);
  if (bookings.length === 0) {
    return Response.json({ error: "No booking found for txRef" }, { status: 400 });
  }

  if (bookings.length > 1) {
    return Response.json({ error: "Multiple bookings found for txRef" }, { status: 409 });
  }

  const [booking] = bookings;

  if (booking.status !== "PENDING") {
    return Response.json({ bookingId: booking.id, status: booking.status });
  }

  // Create a payment record (mimics webhook behavior)
  await prisma.payment.upsert({
    where: { txRef },
    update: {
      status: "SUCCESSFUL",
      amountCharged: Number(booking.totalAmount),
      confirmedAt: new Date(),
    },
    create: {
      txRef,
      status: "SUCCESSFUL",
      amountExpected: Number(booking.totalAmount),
      amountCharged: Number(booking.totalAmount),
      currency: "NGN",
      flutterwaveTransactionId: `test-${txRef}`,
      flutterwaveReference: `test-ref-${txRef}`,
      confirmedAt: new Date(),
      bookingId: booking.id,
    },
  });

  const activated = await activateBooking(booking.id, `test-${txRef}`);

  return Response.json({
    bookingId: activated.id,
    status: activated.status,
    paymentIntent: txRef,
  });
}
