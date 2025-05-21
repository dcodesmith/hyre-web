import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { findBookingByPaymentIntent } from "~/services/bookings.server";
import { findExtensionByPaymentIntent } from "~/services/extensions.server";
import logger from "~/lib/logger.server";
import { Button } from "~/components/ui/button";
import type {
  PaymentStatus as PrismaPaymentStatus,
  BookingStatus as PrismaBookingStatus,
  Booking,
  Extension,
} from "@prisma/client";
import { formatCurrency } from "~/lib/utils";

interface LoaderBookingData extends Omit<Booking, "totalAmount"> {
  totalAmount: number | null;
}

interface LoaderExtensionData extends Omit<Extension, "totalAmount"> {
  totalAmount: number | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref");
  const fwStatus = url.searchParams.get("status") as "successful" | "cancelled" | "failed" | null;
  const transactionType = url.searchParams.get("transactionType") as
    | "booking_creation"
    | "booking_extension"
    | null;
  const flutterwaveTransactionId = url.searchParams.get("transaction_id");

  logger.info(
    `[PaymentStatus Loader] Received: tx_ref=${txRef}, fwStatus=${fwStatus}, transactionType=${transactionType}, fw_tx_id=${flutterwaveTransactionId}`,
  );

  let initialError: string | null = null;
  let bookingData: LoaderBookingData | null = null;
  let extensionData: LoaderExtensionData | null = null;

  if (!txRef) {
    initialError = "Transaction reference (tx_ref) is missing from the URL.";
    logger.warn("[PaymentStatus Loader] tx_ref missing.");
    return json(
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
    logger.warn("[PaymentStatus Loader] transactionType missing.");
    return json(
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
    const extension = await findExtensionByPaymentIntent(txRef);
    if (extension) {
      extensionData = {
        ...extension,
        totalAmount: extension.totalAmount ? Number(extension.totalAmount) : null,
      };
      logger.info(`[PaymentStatus Loader] Extension Data: ${JSON.stringify(extensionData)}`);
    } else {
      logger.warn(`[PaymentStatus Loader] Extension with tx_ref ${txRef} not found in DB yet.`);
    }
  } else if (transactionType === "booking_creation") {
    const booking = await findBookingByPaymentIntent(txRef);
    if (booking) {
      bookingData = {
        ...booking,
        totalAmount: booking.totalAmount ? Number(booking.totalAmount) : null,
      };
      logger.info(`[PaymentStatus Loader] Booking Data: ${JSON.stringify(bookingData)}`);
    } else {
      logger.warn(`[PaymentStatus Loader] Booking with tx_ref ${txRef} not found in DB yet.`);
    }
  } else {
    initialError = "Invalid transactionType specified.";
    logger.warn(`[PaymentStatus Loader] Invalid transactionType: ${transactionType}`);
  }

  return json({
    txRef,
    fwStatus,
    flutterwaveTransactionId,
    transactionType,
    bookingData,
    extensionData,
    initialError,
    bookingNotFoundInDb: bookingData === null && extensionData === null && !initialError,
  });
}

// Type for our loader data
type LoaderData = SerializeFrom<typeof loader>;

const MAX_POLLING_ATTEMPTS = 20; // Approx 1 minute if 3s interval
const POLLING_INTERVAL = 3000; // 3 seconds

export default function BookingPaymentStatusPage() {
  const initialLoaderData = useLoaderData<LoaderData>();
  const fetcher = useFetcher<LoaderData>();

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
  const [pollingCount, setPollingCount] = useState(0);

  useEffect(() => {
    // Determine if polling should stop based on current data
    let shouldStopPolling = false;
    if (
      initialError ||
      fwStatus === "cancelled" ||
      fwStatus === "failed" ||
      (transactionType === "booking_creation" && currentBookingData?.status === "CONFIRMED") ||
      (transactionType === "booking_extension" && currentExtensionData?.paymentStatus === "PAID") ||
      pollingCount >= MAX_POLLING_ATTEMPTS
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
        setPollingCount((prev) => prev + 1);
      }
    }, POLLING_INTERVAL);

    return () => clearTimeout(timerId);
  }, [
    initialError,
    fwStatus,
    transactionType,
    currentBookingData,
    currentExtensionData,
    pollingCount, // dependency for MAX_POLLING_ATTEMPTS check
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
    const bookingIdForLink = isBooking ? currentBookingData?.id : currentExtensionData?.bookingId;
    const amount = successfulData?.totalAmount;
    const paymentIdToDisplay = successfulData?.paymentId || flutterwaveTransactionId;

    const guestEmail =
      currentBookingData?.guestUser?.email || currentExtensionData?.booking?.guestUser?.email;

    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
        <h1 className="text-2xl font-bold text-green-700 mb-4">Payment Successful!</h1>
        <p className="text-green-600 mb-6">
          Your {isBooking ? "booking" : "booking extension"} has been confirmed.
        </p>
        <div className="text-left space-y-2 mb-6 bg-white p-4 rounded-md border border-green-200">
          {amount !== null && amount !== undefined && (
            <p>
              <strong>Amount Paid:</strong> {formatCurrency(amount)}
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
        : currentExtensionData?.bookingId;

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
        : currentExtensionData?.bookingId;
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
          update automatically. Polling attempt: {pollingCount + 1} / {MAX_POLLING_ATTEMPTS}.
        </p>
        <svg
          className="animate-spin h-8 w-8 text-blue-600 mx-auto"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <title>Loading spinner</title>
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  // Polling timed out OR (record not found AND polling stopped)
  if (pollingStopped) {
    const bookingIdForLink =
      transactionType === "booking_creation"
        ? currentBookingData?.id
        : currentExtensionData?.bookingId;
    let linkTarget = "/";
    let linkText = "Return to Home";

    if (bookingIdForLink) {
      linkTarget = `/bookings/${bookingIdForLink}`;
      linkText = "Check Booking Status";
    } else if (transactionType === "booking_creation") {
      linkTarget = "/bookings";
      linkText = "Back to Bookings";
    }

    return (
      <div className="max-w-lg mx-auto mt-8 p-6 bg-yellow-50 border border-yellow-300 rounded-lg text-center">
        <h1 className="text-xl font-semibold text-yellow-700 mb-3">Payment Verification Pending</h1>
        <p className="text-yellow-600 mb-5">
          We are still verifying your payment for transaction reference:{" "}
          <strong>{txRef || "N/A"}</strong>. This can sometimes take a few moments. Please check
          your booking details shortly. If the status doesn't update soon, (
          {currentBookingNotFoundInDb
            ? "transaction not found in our records yet"
            : "status still processing"}
          ), please contact support.
        </p>
        <Link to={linkTarget}>
          <Button variant="outline">{linkText}</Button>
        </Link>
      </div>
    );
  }

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
