import {
  ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { requireUser } from "~/modules/auth/auth.server";
import { cancelBooking, getBooking } from "~/services/bookings.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log("action");
  const formData = await request.formData();
  const bookingId = formData.get("bookingId");
  const reason = formData.get("reason");

  if (!bookingId || typeof bookingId !== "string") {
    return json({ error: "Booking ID is required" }, { status: 400 });
  }

  if (!reason || typeof reason !== "string") {
    return json({ error: "Cancellation reason is required" }, { status: 400 });
  }

  try {
    await cancelBooking(bookingId, reason);
    return json({ success: true });
  } catch (error) {
    return json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  console.log(">>", params);
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  invariant(bookingId, "Booking ID is required");

  const booking = await getBooking(bookingId);

  if (!booking) {
    return redirect("/bookings");
  }

  return json({ booking });
}

export default function PaymentRoute() {
  const { booking } = useLoaderData<typeof loader>();
  // const fetcher = useFetcher();

  return (
    <div>
      <h2>Payment</h2>
      <div className="grid gap-4"></div>
    </div>
  );
}
