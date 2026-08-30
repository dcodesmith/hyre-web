import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { PaymentStatusView } from "~/payment/payment-status-view";

const POLLING_INTERVAL_MS = 3_000;
const POLLING_BUDGET_MS = 90_000;

interface PaymentStatusPollData {
  readonly txRef: string;
  readonly status: PaymentStatusView | null;
  readonly error: string | null;
}

function isPending(status: PaymentStatusView | null) {
  return status?.lifecycleState === "PENDING" || status?.lifecycleState === "VERIFYING";
}

/** Polls the same-origin payment status loader within a bounded verification window. */
export function usePaymentStatusPolling({
  txRef,
  initialStatus,
}: {
  readonly txRef: string;
  readonly initialStatus: PaymentStatusView | null;
}) {
  const fetcher = useFetcher<PaymentStatusPollData>();
  const fetcherRef = useRef(fetcher);
  const startedAtRef = useRef(Date.now());
  const [timedOut, setTimedOut] = useState(false);

  const fetchedStatus = fetcher.data?.txRef === txRef ? fetcher.data.status : null;
  const status = fetchedStatus ?? initialStatus;

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!isPending(status) || timedOut) {
      return;
    }

    const poll = () => {
      if (Date.now() - startedAtRef.current >= POLLING_BUDGET_MS) {
        setTimedOut(true);
        return;
      }

      if (fetcherRef.current.state === "idle") {
        void fetcherRef.current.load(
          `/bookings/payment-status?${new URLSearchParams({ tx_ref: txRef, poll: "1" })}`,
        );
      }
    };
    const interval = window.setInterval(poll, POLLING_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [status, timedOut, txRef]);

  return {
    status,
    error: fetcher.data?.txRef === txRef ? fetcher.data.error : null,
    isRefreshing: fetcher.state !== "idle",
    timedOut,
    retry() {
      startedAtRef.current = Date.now();
      setTimedOut(false);
      void fetcherRef.current.load(
        `/bookings/payment-status?${new URLSearchParams({ tx_ref: txRef, poll: "1" })}`,
      );
    },
  };
}
