import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmBookingPayment,
  confirmExtensionPayment,
  getBookingPaymentStatus,
  getExtensionPaymentStatus,
  reconcileBookingExpiration,
  readAuthUser,
  readPaymentStatusSession,
  paymentStatusClearCookies,
} = vi.hoisted(() => ({
  confirmBookingPayment: vi.fn(),
  confirmExtensionPayment: vi.fn(),
  getBookingPaymentStatus: vi.fn(),
  getExtensionPaymentStatus: vi.fn(),
  reconcileBookingExpiration: vi.fn(),
  readAuthUser: vi.fn(),
  readPaymentStatusSession: vi.fn(),
  paymentStatusClearCookies: vi.fn(async () => ["payment_status=; Max-Age=0"]),
}));

vi.mock("~/api/payments/payments.server", () => ({
  confirmBookingPayment,
  confirmExtensionPayment,
  getBookingPaymentStatus,
  getExtensionPaymentStatus,
  reconcileBookingExpiration,
}));
vi.mock("~/auth/session.server", () => ({ readAuthUser }));
vi.mock("~/payment/payment-status-session.server", () => ({
  readPaymentStatusSession,
  paymentStatusClearCookies,
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
      kind: "booking",
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
      data: { status: { kind: "booking", ...confirmedStatus }, error: null },
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

  it("confirms a signed-in extension callback against the stored extension", async () => {
    readAuthUser.mockResolvedValue({ email: "customer@example.com", name: "Ada" });
    readPaymentStatusSession.mockResolvedValue({
      kind: "extension",
      bookingId: "booking-1",
      extensionId: "extension-1",
      txRef: "ext-tx-1",
    });
    confirmExtensionPayment.mockResolvedValue({
      data: {
        txRef: "ext-tx-1",
        status: "SUCCESSFUL",
        amountExpected: 25_000,
        amountCharged: 25_000,
        confirmedAt: "2026-08-30T00:00:00.000Z",
        extension: { id: "extension-1", status: "ACTIVE" },
      },
    });

    const result = await loader({
      request: new Request(
        "https://tripdly.com/bookings/payment-status?tx_ref=ext-tx-1&transaction_id=456",
        { headers: { Cookie: "better-auth.session_token=session" } },
      ),
      params: {},
      context: {},
    } as never);

    expect(confirmExtensionPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: "extension-1",
        txRef: "ext-tx-1",
        transactionId: "456",
      }),
    );
    expect(confirmBookingPayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        status: {
          kind: "extension",
          bookingId: "booking-1",
          lifecycleState: "CONFIRMED",
        },
        error: null,
      },
    });
  });

  it("falls back to status polling when extension confirmation fails transiently", async () => {
    readAuthUser.mockResolvedValue({ email: "customer@example.com", name: "Ada" });
    readPaymentStatusSession.mockResolvedValue({
      kind: "extension",
      bookingId: "booking-1",
      extensionId: "extension-1",
      txRef: "ext-tx-1",
    });
    confirmExtensionPayment.mockRejectedValue(new Error("temporary network failure"));
    getExtensionPaymentStatus.mockResolvedValue({
      data: {
        txRef: "ext-tx-1",
        status: "PENDING",
        amountExpected: 25_000,
        amountCharged: null,
        confirmedAt: null,
        extension: { id: "extension-1", status: "PENDING" },
      },
    });

    const result = await loader({
      request: new Request(
        "https://tripdly.com/bookings/payment-status?tx_ref=ext-tx-1&transaction_id=456",
        { headers: { Cookie: "better-auth.session_token=session" } },
      ),
      params: {},
      context: {},
    } as never);

    expect(getExtensionPaymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txRef: "ext-tx-1" }),
    );
    expect(result).toMatchObject({
      data: {
        status: {
          kind: "extension",
          bookingId: "booking-1",
          lifecycleState: "PENDING",
        },
        error: null,
      },
    });
  });
});
