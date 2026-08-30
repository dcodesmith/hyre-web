import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { data, Link } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  confirmBookingPayment,
  confirmExtensionPayment,
  getBookingPaymentStatus,
  getExtensionPaymentStatus,
  reconcileBookingExpiration,
} from "~/api/payments/payments.server";
import { readAuthUser } from "~/auth/session.server";
import { Button } from "~/components/ui/button";
import { usePaymentStatusPolling } from "~/hooks/use-payment-status-polling";
import {
  type PaymentStatusSession,
  paymentStatusClearCookies,
  readPaymentStatusSession,
} from "~/payment/payment-status-session.server";
import {
  bookingPaymentStatusView,
  extensionPaymentStatusView,
  type PaymentStatusView,
} from "~/payment/payment-status-view";
import type { Route } from "./+types/payment-status";

const NO_STORE = { "Cache-Control": "private, no-store" };
const PAYMENT_ERROR = "Unable to verify this payment right now. Please try again.";

export const meta: Route.MetaFunction = () => [
  { title: "Payment status | Tripdly" },
  { name: "robots", content: "noindex, nofollow" },
];

function isTerminal(status: PaymentStatusView) {
  return (
    status.lifecycleState === "CONFIRMED" ||
    status.lifecycleState === "FAILED" ||
    status.lifecycleState === "EXPIRED"
  );
}

async function loadExtensionStatus(
  request: Request,
  session: Extract<PaymentStatusSession, { kind: "extension" }>,
  transactionId: string,
  isPoll: boolean,
) {
  let response: Awaited<ReturnType<typeof getExtensionPaymentStatus>>;

  if (transactionId && !isPoll) {
    try {
      response = await confirmExtensionPayment({
        request,
        extensionId: session.extensionId,
        txRef: session.txRef,
        transactionId,
      });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        (error.kind === "aborted" ||
          (error.kind === "http" && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR))
      ) {
        throw error;
      }
      response = await getExtensionPaymentStatus({ request, txRef: session.txRef });
    }
  } else {
    response = await getExtensionPaymentStatus({ request, txRef: session.txRef });
  }

  return response.data.extension.id === session.extensionId
    ? extensionPaymentStatusView(response.data, session.bookingId)
    : null;
}

async function loadBookingStatus(
  request: Request,
  session: Extract<PaymentStatusSession, { kind: "booking" }>,
  transactionId: string,
  isPoll: boolean,
  paymentStatusToken: string | undefined,
) {
  let response =
    transactionId && !isPoll
      ? await confirmBookingPayment({
          request,
          txRef: session.txRef,
          bookingId: session.bookingId,
          transactionId,
          paymentStatusToken,
        })
      : await getBookingPaymentStatus({
          request,
          txRef: session.txRef,
          bookingId: session.bookingId,
          paymentStatusToken,
        });

  if (isPoll && response.data.lifecycleState === "VERIFYING") {
    try {
      response = await reconcileBookingExpiration({
        request,
        txRef: session.txRef,
        bookingId: session.bookingId,
        paymentStatusToken,
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.kind === "aborted") {
        throw error;
      }
    }
  }

  return bookingPaymentStatusView(response.data);
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

  const hasAuthSession = hasSessionCookie(request.headers.get("Cookie"));
  const paymentSession = await readPaymentStatusSession(request, txRef);

  if (!paymentSession || paymentSession.txRef !== txRef) {
    return data(
      {
        txRef,
        status: null,
        error: "Payment verification credentials are missing. Contact support if you were charged.",
        isSignedIn: hasAuthSession,
      },
      { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE },
    );
  }

  let isSignedIn = hasAuthSession;
  let paymentStatusToken: string | undefined;

  if (paymentSession.kind === "booking") {
    isSignedIn = (await readAuthUser(request)) != null;
    paymentStatusToken = isSignedIn ? undefined : paymentSession.paymentStatusToken;
  }

  if (!isSignedIn && (paymentSession.kind === "extension" || !paymentStatusToken)) {
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
    const status =
      paymentSession.kind === "extension"
        ? await loadExtensionStatus(request, paymentSession, transactionId, isPoll)
        : await loadBookingStatus(
            request,
            paymentSession,
            transactionId,
            isPoll,
            paymentStatusToken,
          );

    if (!status) {
      return data(
        {
          txRef,
          status: null,
          error: "Payment verification credentials do not match this extension.",
          isSignedIn,
        },
        { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE },
      );
    }

    const headers = new Headers(NO_STORE);
    if (isTerminal(status)) {
      for (const cookie of await paymentStatusClearCookies(txRef)) {
        headers.append("Set-Cookie", cookie);
      }
    }

    return data({ txRef, status, error: null, isSignedIn }, { headers });
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

function PaymentUnavailable({ error }: { readonly error: string | null }) {
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

function ConfirmedPayment({
  isSignedIn,
  status,
}: {
  readonly isSignedIn: boolean;
  readonly status: PaymentStatusView;
}) {
  const isExtension = status.kind === "extension";

  return (
    <PaymentStatusCard>
      <CheckCircle2 className="mx-auto size-12 text-green-600" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">
        {isExtension ? "Extension payment confirmed" : "Payment confirmed"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {isExtension
          ? "Your trip extension is confirmed."
          : `Booking ${status.bookingReference} is confirmed.`}
      </p>
      <Button asChild className="mt-6">
        <Link to={isSignedIn ? `/bookings/${status.bookingId}` : "/"}>
          {isSignedIn ? "View booking" : "Return home"}
        </Link>
      </Button>
    </PaymentStatusCard>
  );
}

function failedPaymentCopy(status: PaymentStatusView) {
  const expired = status.lifecycleState === "EXPIRED";

  if (status.kind === "extension") {
    return expired
      ? {
          title: "Extension reservation expired",
          description: "The extension hold expired before payment was confirmed.",
        }
      : {
          title: "Extension payment needs attention",
          description: "The extension could not be confirmed. Contact support if you were charged.",
        };
  }

  return expired
    ? {
        title: "Booking reservation expired",
        description: "The reservation expired before payment was confirmed.",
      }
    : {
        title: "Payment failed",
        description: "The payment could not be completed. Contact support if you were charged.",
      };
}

function FailedPayment({ status }: { readonly status: PaymentStatusView }) {
  const expired = status.lifecycleState === "EXPIRED";
  const isExtension = status.kind === "extension";
  const copy = failedPaymentCopy(status);

  return (
    <PaymentStatusCard>
      {expired ? (
        <Clock3 className="mx-auto size-12 text-orange-600" aria-hidden="true" />
      ) : (
        <XCircle className="mx-auto size-12 text-red-600" aria-hidden="true" />
      )}
      <h1 className="mt-4 text-xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-sm text-gray-600">{copy.description}</p>
      <Button asChild className="mt-6">
        <Link to={isExtension ? `/bookings/${status.bookingId}` : "/search"}>
          {isExtension ? "View booking" : "Search again"}
        </Link>
      </Button>
    </PaymentStatusCard>
  );
}

function PendingPayment({
  error,
  isRefreshing,
  isTimedOut,
  retry,
  status,
}: {
  readonly error: string | null;
  readonly isRefreshing: boolean;
  readonly isTimedOut: boolean;
  readonly retry: () => void;
  readonly status: PaymentStatusView;
}) {
  return (
    <PaymentStatusCard>
      <Loader2
        className="mx-auto size-12 animate-spin text-blue-600 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <h1 className="mt-4 text-xl font-semibold">
        {status.kind === "extension"
          ? "Confirming your extension payment"
          : "Confirming your payment"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Keep this page open while we verify the transaction.
      </p>
      {error || isTimedOut ? (
        <>
          <p className="mt-4 text-sm text-red-700">{isTimedOut ? PAYMENT_ERROR : error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={isRefreshing}
            onClick={retry}
          >
            Retry verification
          </Button>
        </>
      ) : null}
    </PaymentStatusCard>
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
    return <PaymentUnavailable error={error} />;
  }

  if (status.lifecycleState === "CONFIRMED") {
    return <ConfirmedPayment status={status} isSignedIn={loaderData.isSignedIn} />;
  }

  if (status.lifecycleState === "FAILED" || status.lifecycleState === "EXPIRED") {
    return <FailedPayment status={status} />;
  }

  return (
    <PendingPayment
      error={error}
      isRefreshing={payment.isRefreshing}
      isTimedOut={payment.timedOut}
      retry={payment.retry}
      status={status}
    />
  );
}
