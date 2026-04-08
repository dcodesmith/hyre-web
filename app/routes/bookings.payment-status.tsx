import type { Booking, Prisma } from "@prisma/client";
import { type LoaderFunctionArgs, data, Link, useFetcher, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "~/components/ui/button";
import logger from "~/lib/logger.server";
import { formatCurrency } from "~/lib/utils";
import { findBookingByPaymentIntent } from "~/services/bookings.server";
import { findExtensionByPaymentIntent } from "~/services/extensions.server";

interface LoaderBookingData extends Omit<Booking, "totalAmount"> {
  totalAmount: number | null;
}

type ExtensionWithDetails = Prisma.ExtensionGetPayload<{
  include: {
    bookingLeg: {
      include: {
        booking: {
          include: {
            car: true;
            user: true;
          };
        };
      };
    };
  };
}>;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref");
  const fwStatus = url.searchParams.get("status") as "successful" | "cancelled" | "failed" | null;
  const transactionType = url.searchParams.get("transactionType") as
    | "booking_creation"
    | "booking_extension"
    | null;
  const flutterwaveTransactionId = url.searchParams.get("transaction_id");

  logger.info("[PaymentStatus Loader] Received payment status", {
    txRef,
    fwStatus,
    transactionType,
    flutterwaveTransactionId,
  });

  let initialError: string | null = null;
  let bookingData: LoaderBookingData | null = null;
  let extensionData: ExtensionWithDetails | null = null;

  if (!txRef) {
    initialError = "Transaction reference (tx_ref) is missing from the URL.";
    logger.warn("[PaymentStatus Loader] tx_ref missing");
    return data(
      {
        txRef: null,
        fwStatus,
        flutterwaveTransactionId,
        transactionType,
        bookingData: null,
        extensionData: null,
        initialError,
        bookingNotFoundInDb: true,
      },
      { status: 400 },
    );
  }

  if (!transactionType) {
    initialError = "Transaction type (transactionType) is missing from the URL.";
    logger.warn("[PaymentStatus Loader] transactionType missing");
    return data(
      {
        txRef,
        fwStatus,
        flutterwaveTransactionId,
        transactionType: null,
        bookingData: null,
        extensionData: null,
        initialError,
        bookingNotFoundInDb: true,
      },
      { status: 400 },
    );
  }

  if (transactionType === "booking_extension") {
    extensionData = await findExtensionByPaymentIntent(txRef);
    if (extensionData) {
      logger.info("[PaymentStatus Loader] Extension Data", extensionData);
    } else {
      logger.warn("[PaymentStatus Loader] Extension with tx_ref not found in DB yet", { txRef });
    }
  } else if (transactionType === "booking_creation") {
    const booking = await findBookingByPaymentIntent(txRef);
    if (booking) {
      bookingData = {
        ...booking,
        totalAmount: booking.totalAmount ? Number(booking.totalAmount) : null,
      };
      logger.info("[PaymentStatus Loader] Booking Data", bookingData);
    } else {
      logger.warn("[PaymentStatus Loader] Booking with tx_ref not found in DB yet", { txRef });
    }
  } else {
    initialError = "Invalid transactionType specified.";
    logger.warn("[PaymentStatus Loader] Invalid transactionType", { transactionType });
  }

  return {
    txRef,
    fwStatus,
    flutterwaveTransactionId,
    transactionType,
    bookingData,
    extensionData,
    initialError,
    bookingNotFoundInDb: bookingData === null && extensionData === null && !initialError,
  };
}

const POLLING_INTERVAL = 3000; // 3 seconds

function extractEmailFromJson(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const maybe = value as { email?: unknown };
    if (typeof maybe.email === "string") {
      return maybe.email;
    }
  }
  return undefined;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI state machine with many branches
export default function BookingPaymentStatusPage() {
  const initialLoaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof loader>();

  const currentData = fetcher.data || initialLoaderData;
  const {
    txRef,
    fwStatus,
    flutterwaveTransactionId,
    transactionType,
    bookingData: currentBookingData,
    extensionData: currentExtensionData,
    initialError,
    bookingNotFoundInDb: currentBookingNotFoundInDb,
  } = currentData;

  const [pollingStopped, setPollingStopped] = useState(false);

  useEffect(() => {
    // Determine if polling should stop based on current data
    let shouldStopPolling = false;
    if (
      initialError ||
      fwStatus === "cancelled" ||
      fwStatus === "failed" ||
      (transactionType === "booking_creation" && currentBookingData?.status === "CONFIRMED") ||
      (transactionType === "booking_extension" && currentExtensionData?.paymentStatus === "PAID")
    ) {
      shouldStopPolling = true;
    }

    if (shouldStopPolling) {
      setPollingStopped(true);
      return; // Exit effect, no timer will be set or run
    }

    // If pollingStopped is already true from a previous render (e.g. user action, though not implemented here)
    // or if we determined it should stop now, we don't proceed.
    // The check above handles determination, this ensures if state is already true, we don't set a timer.
    if (pollingStopped) {
      return;
    }

    // If we reach here, polling should continue
    const timerId = setTimeout(() => {
      if (fetcher.state === "idle") {
        const searchParams = new URLSearchParams(window.location.search);
        fetcher.load(`${window.location.pathname}?${searchParams.toString()}`);
      }
    }, POLLING_INTERVAL);

    return () => clearTimeout(timerId);
  }, [
    initialError,
    fwStatus,
    transactionType,
    currentBookingData,
    currentExtensionData,
    fetcher, // fetcher.state is used
    pollingStopped, // if pollingStopped becomes true elsewhere, this effect should re-evaluate
  ]);

  if (initialError) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
        <h1 className="text-xl font-semibold text-red-700 mb-3">Payment Status Error</h1>
        <p className="text-red-600 mb-5">{initialError}</p>
        <Link to="/">
          <Button variant="outline">Return to Home</Button>
        </Link>
      </div>
    );
  }

  // Successful Payment
  if (
    (transactionType === "booking_creation" && currentBookingData?.status === "CONFIRMED") ||
    (transactionType === "booking_extension" && currentExtensionData?.paymentStatus === "PAID")
  ) {
    const isBooking = transactionType === "booking_creation";
    const successfulData = isBooking ? currentBookingData : currentExtensionData;
    const bookingIdForLink = isBooking
      ? currentBookingData?.id
      : currentExtensionData?.bookingLeg.booking.id;
    const amount = successfulData?.totalAmount;
    const paymentIdToDisplay = successfulData?.paymentId || flutterwaveTransactionId;

    const guestEmail =
      extractEmailFromJson(currentBookingData?.guestUser) ||
      extractEmailFromJson(currentExtensionData?.bookingLeg.booking.guestUser);

    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
        <h1 className="text-2xl font-bold text-green-700 mb-4">Payment Successful!</h1>
        <p className="text-green-600 mb-6">
          Your {isBooking ? "booking" : "booking extension"} has been confirmed.
        </p>
        <div className="text-left space-y-2 mb-6 bg-white p-4 rounded-md border border-green-200">
          {amount !== null && amount !== undefined && (
            <p aria-label="Amount paid">
              <strong>Amount Paid:</strong> {formatCurrency(Number(amount))}
            </p>
          )}
          {paymentIdToDisplay && (
            <p>
              <strong>Transaction ID:</strong> {paymentIdToDisplay}
            </p>
          )}
          {txRef && (
            <p>
              <strong>Transaction Reference:</strong> {txRef}
            </p>
          )}
        </div>
        {bookingIdForLink && (
          <Link
            to={`/bookings/${bookingIdForLink}${guestEmail ? `?email=${encodeURIComponent(guestEmail)}` : ""}`}
          >
            <Button variant="default" className="bg-green-600 hover:bg-green-700">
              View {isBooking ? "Booking" : "Updated Booking"}
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Payment Cancelled by User
  if (fwStatus === "cancelled") {
    const bookingIdForLink =
      transactionType === "booking_creation"
        ? currentBookingData?.id
        : currentExtensionData?.bookingLeg.booking.id;

    let linkTarget = "/";
    let linkText = "Return to Home";

    if (bookingIdForLink) {
      linkTarget = `/bookings/${bookingIdForLink}`;
      linkText = "Back to Booking";
    } else if (transactionType === "booking_creation") {
      linkTarget = "/bookings";
      linkText = "Back to Bookings";
    }

    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-orange-50 border border-orange-200 rounded-lg text-center">
        <h1 className="text-xl font-semibold text-orange-700 mb-3">Payment Cancelled</h1>
        <p className="text-orange-600 mb-5">
          You cancelled the payment process. No charge was made.
        </p>
        <Link to={linkTarget}>
          <Button variant="outline">{linkText}</Button>
        </Link>
      </div>
    );
  }

  // Payment Failed from Flutterwave
  if (fwStatus === "failed") {
    const bookingIdForLink =
      transactionType === "booking_creation"
        ? currentBookingData?.id
        : currentExtensionData?.bookingLeg.booking.id;
    let linkTarget = "/";
    let linkText = "Return to Home";
    if (bookingIdForLink) {
      linkTarget = `/bookings/${bookingIdForLink}`;
      linkText = "Back to Booking";
    } else if (transactionType === "booking_creation") {
      linkTarget = "/bookings";
      linkText = "Try Again";
    }

    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
        <h1 className="text-xl font-semibold text-red-700 mb-3">Payment Failed</h1>
        <p className="text-red-600 mb-5">
          Unfortunately, the payment attempt failed. Please try again or contact support if the
          issue persists.
        </p>
        <Link to={linkTarget}>
          <Button variant="outline">{linkText}</Button>
        </Link>
      </div>
    );
  }

  // This is the "Verifying Payment..." or "Processing" state
  if (!pollingStopped && (fwStatus === "successful" || !fwStatus) && !initialError) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <h1 className="text-xl font-semibold text-blue-700 mb-3">Verifying Payment...</h1>
        <p className="text-blue-600 mb-5">
          Please wait while we confirm your transaction (Ref: {txRef || "N/A"}). This page will
          update automatically.
        </p>
        <ArrowPathIcon className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
      </div>
    );
  }

  // Removed timeout-based pending UI; polling continues until a terminal state is reached.

  // Fallback: Should ideally not be reached if logic above is comprehensive.
  // This could be if fwStatus is something unexpected, or a combination of states not explicitly handled.
  return (
    <div className="max-w-lg mx-auto mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
      <h1 className="text-xl font-semibold text-gray-700 mb-3">Checking Payment Status</h1>
      <p className="text-gray-600 mb-5">
        Attempting to retrieve payment details for transaction reference: {txRef || "N/A"}.
        {currentBookingNotFoundInDb &&
          pollingStopped &&
          " We could not find this transaction after checking. Please contact support if you made a payment."}
        {!pollingStopped && !initialError && " Please wait..."}
      </p>
      <Link to="/">
        <Button variant="outline">Return to Home</Button>
      </Link>
    </div>
  );
}
