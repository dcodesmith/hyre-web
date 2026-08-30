import type { BookingPaymentStatus, ExtensionPaymentStatus } from "~/api/payments/schema";

export type PaymentStatusView =
  | (BookingPaymentStatus & { readonly kind: "booking" })
  | {
      readonly kind: "extension";
      readonly bookingId: string;
      readonly lifecycleState: "PENDING" | "VERIFYING" | "CONFIRMED" | "FAILED" | "EXPIRED";
    };

export function bookingPaymentStatusView(status: BookingPaymentStatus): PaymentStatusView {
  return { kind: "booking", ...status };
}

export function extensionPaymentStatusView(
  status: ExtensionPaymentStatus,
  bookingId: string,
): PaymentStatusView {
  let lifecycleState: Extract<PaymentStatusView, { kind: "extension" }>["lifecycleState"];

  if (status.status === "SUCCESSFUL" && status.extension.status === "ACTIVE") {
    lifecycleState = "CONFIRMED";
  } else if (status.status === "SUCCESSFUL") {
    lifecycleState = "FAILED";
  } else if (status.extension.status === "CANCELLED") {
    lifecycleState = "EXPIRED";
  } else if (status.status === "PENDING") {
    lifecycleState = "PENDING";
  } else {
    lifecycleState = "FAILED";
  }

  return {
    kind: "extension",
    bookingId,
    lifecycleState,
  };
}
