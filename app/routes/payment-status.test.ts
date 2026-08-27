import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmBookingPayment,
  getBookingPaymentStatus,
  reconcileBookingExpiration,
  readAuthUser,
  readPaymentStatusSession,
  paymentStatusClearCookie,
} = vi.hoisted(() => ({
  confirmBookingPayment: vi.fn(),
  getBookingPaymentStatus: vi.fn(),
  reconcileBookingExpiration: vi.fn(),
  readAuthUser: vi.fn(),
  readPaymentStatusSession: vi.fn(),
  paymentStatusClearCookie: vi.fn(() => "payment_status=; Max-Age=0"),
}));

vi.mock("~/api/payments/payments.server", () => ({
  confirmBookingPayment,
  getBookingPaymentStatus,
  reconcileBookingExpiration,
}));
vi.mock("~/auth/session.server", () => ({ readAuthUser }));
vi.mock("~/payment/payment-status-session.server", () => ({
  readPaymentStatusSession,
  paymentStatusClearCookie,
}));

import { loader } from "./payment-status";

const confirmedStatus = {
  bookingId: "booking-1",
  bookingReference: "HY-001",
  txRef: "tx-1",
  bookingStatus: "CONFIRMED",
  paymentStatus: "COMPLETED",
  paymentId: "payment-1",
  totalAmount: 120000,
  reservationExpiresAt: null,
  lifecycleState: "CONFIRMED" as const,
};

describe("payment status loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthUser.mockResolvedValue(null);
    readPaymentStatusSession.mockResolvedValue({
      bookingId: "booking-1",
      txRef: "tx-1",
      paymentStatusToken: "guest-token",
    });
  });

  it("confirms the provider callback with the protected guest token", async () => {
    confirmBookingPayment.mockResolvedValue({ data: confirmedStatus });

    const result = await loader({
      request: new Request(
        "https://tripdly.com/bookings/payment-status?tx_ref=tx-1&transaction_id=123",
      ),
      params: {},
      context: {},
    } as never);

    expect(confirmBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        txRef: "tx-1",
        transactionId: "123",
        paymentStatusToken: "guest-token",
      }),
    );
    expect(result).toMatchObject({
      data: { status: confirmedStatus, error: null },
    });
    const headers = new Headers(result.init?.headers);
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("does not expose another transaction through the stored credential", async () => {
    const result = await loader({
      request: new Request(
        "https://tripdly.com/bookings/payment-status?tx_ref=another-transaction",
      ),
      params: {},
      context: {},
    } as never);

    expect(getBookingPaymentStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      init: { status: 401 },
      data: { status: null },
    });
  });
});
