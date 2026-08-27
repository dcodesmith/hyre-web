import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { data, Link } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  confirmBookingPayment,
  getBookingPaymentStatus,
  reconcileBookingExpiration,
} from "~/api/payments/payments.server";
import type { BookingPaymentStatus } from "~/api/payments/schema";
import { readAuthUser } from "~/auth/session.server";
import { Button } from "~/components/ui/button";
import { usePaymentStatusPolling } from "~/hooks/use-payment-status-polling";
import {
  paymentStatusClearCookie,
  readPaymentStatusSession,
} from "~/payment/payment-status-session.server";
import type { Route } from "./+types/payment-status";

const NO_STORE = { "Cache-Control": "private, no-store" };
const PAYMENT_ERROR = "Unable to verify this payment right now. Please try again.";

export const meta: Route.MetaFunction = () => [
  { title: "Payment status | Tripdly" },
  { name: "robots", content: "noindex, nofollow" },
];

function isTerminal(status: BookingPaymentStatus) {
  return (
    status.lifecycleState === "CONFIRMED" ||
    status.lifecycleState === "FAILED" ||
    status.lifecycleState === "EXPIRED"
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref")?.trim() ?? "";
  const transactionId = url.searchParams.get("transaction_id")?.trim() ?? "";
  const isPoll = url.searchParams.get("poll") === "1";

  if (!txRef) {
    return data(
      {
        txRef,
        status: null,
        error: "Missing transaction details from the payment provider.",
        isSignedIn: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  const [user, paymentSession] = await Promise.all([
    readAuthUser(request),
    readPaymentStatusSession(request),
  ]);
  const isSignedIn = user != null;

  if (!paymentSession || paymentSession.txRef !== txRef) {
    return data(
      {
        txRef,
        status: null,
        error: "Payment verification credentials are missing. Contact support if you were charged.",
        isSignedIn,
      },
      { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE },
    );
  }

  const paymentStatusToken = isSignedIn ? undefined : paymentSession.paymentStatusToken;

  if (!isSignedIn && !paymentStatusToken) {
    return data(
      {
        txRef,
        status: null,
        error: "Payment verification credentials are missing. Contact support if you were charged.",
        isSignedIn,
      },
      { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE },
    );
  }

  try {
    let response =
      transactionId && !isPoll
        ? await confirmBookingPayment({
            request,
            txRef,
            bookingId: paymentSession.bookingId,
            transactionId,
            paymentStatusToken,
          })
        : await getBookingPaymentStatus({
            request,
            txRef,
            bookingId: paymentSession.bookingId,
            paymentStatusToken,
          });

    if (isPoll && response.data.lifecycleState === "VERIFYING") {
      try {
        response = await reconcileBookingExpiration({
          request,
          txRef,
          bookingId: paymentSession.bookingId,
          paymentStatusToken,
        });
      } catch (error) {
        if (error instanceof ApiRequestError && error.kind === "aborted") {
          throw error;
        }
      }
    }

    const headers = new Headers(NO_STORE);
    if (isTerminal(response.data)) {
      headers.append("Set-Cookie", paymentStatusClearCookie());
    }

    return data({ txRef, status: response.data, error: null, isSignedIn }, { headers });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return data(
      {
        txRef,
        status: null,
        error:
          error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
            ? error.problem.detail
            : PAYMENT_ERROR,
        isSignedIn,
      },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

function PaymentStatusCard({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-12">
      <section
        className="w-full rounded-xl border bg-white p-8 text-center shadow-sm"
        aria-live="polite"
      >
        {children}
      </section>
    </main>
  );
}

export default function PaymentStatus({ loaderData }: Route.ComponentProps) {
  const payment = usePaymentStatusPolling({
    txRef: loaderData.txRef,
    initialStatus: loaderData.status,
  });
  const status = payment.status;
  const error = payment.error ?? loaderData.error;

  if (!status) {
    return (
      <PaymentStatusCard>
        <XCircle className="mx-auto size-12 text-red-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Payment verification unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <Button asChild className="mt-6">
          <Link to="/search">Search for a car</Link>
        </Button>
      </PaymentStatusCard>
    );
  }

  if (status.lifecycleState === "CONFIRMED") {
    return (
      <PaymentStatusCard>
        <CheckCircle2 className="mx-auto size-12 text-green-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Payment confirmed</h1>
        <p className="mt-2 text-sm text-gray-600">
          Booking {status.bookingReference} is confirmed.
        </p>
        <Button asChild className="mt-6">
          <Link to={loaderData.isSignedIn ? `/bookings/${status.bookingId}` : "/"}>
            {loaderData.isSignedIn ? "View booking" : "Return home"}
          </Link>
        </Button>
      </PaymentStatusCard>
    );
  }

  if (status.lifecycleState === "FAILED" || status.lifecycleState === "EXPIRED") {
    const expired = status.lifecycleState === "EXPIRED";
    return (
      <PaymentStatusCard>
        {expired ? (
          <Clock3 className="mx-auto size-12 text-orange-600" aria-hidden="true" />
        ) : (
          <XCircle className="mx-auto size-12 text-red-600" aria-hidden="true" />
        )}
        <h1 className="mt-4 text-xl font-semibold">
          {expired ? "Booking reservation expired" : "Payment failed"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {expired
            ? "The reservation expired before payment was confirmed."
            : "The payment could not be completed. Contact support if you were charged."}
        </p>
        <Button asChild className="mt-6">
          <Link to="/search">Search again</Link>
        </Button>
      </PaymentStatusCard>
    );
  }

  return (
    <PaymentStatusCard>
      <Loader2
        className="mx-auto size-12 animate-spin text-blue-600 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <h1 className="mt-4 text-xl font-semibold">Confirming your payment</h1>
      <p className="mt-2 text-sm text-gray-600">
        Keep this page open while we verify the transaction.
      </p>
      {error || payment.timedOut ? (
        <>
          <p className="mt-4 text-sm text-red-700">{payment.timedOut ? PAYMENT_ERROR : error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={payment.isRefreshing}
            onClick={payment.retry}
          >
            Retry verification
          </Button>
        </>
      ) : null}
    </PaymentStatusCard>
  );
}
