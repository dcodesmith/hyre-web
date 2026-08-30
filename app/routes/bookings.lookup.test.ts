import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestGuestBookingAccess } = vi.hoisted(() => ({
  requestGuestBookingAccess: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/bookings/bookings.server", () => ({ requestGuestBookingAccess }));

import { HTTP_STATUS } from "~/api/http-status";
import { action, loader } from "./bookings.lookup";

async function runAction(form: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) {
    body.set(name, value);
  }

  return action({
    request: new Request("https://tripdly.com/bookings/lookup", {
      method: "POST",
      body,
    }),
    params: {},
  } as Parameters<typeof action>[0]);
}

describe("guest booking lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the booking details and keeps the API response generic", async () => {
    requestGuestBookingAccess.mockResolvedValue({
      data: {
        message: "If those booking details match, we sent an access link to the booking email.",
      },
    });

    const result = await runAction({
      bookingReference: " bk-123 ",
      email: " Guest@Example.com ",
    });

    expect(requestGuestBookingAccess).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: { bookingReference: "BK-123", email: "guest@example.com" },
    });
    expect(result).toMatchObject({
      data: {
        message: "If those booking details match, we sent an access link to the booking email.",
      },
      init: { status: 202 },
    });
  });

  it("rejects invalid input before calling the API", async () => {
    const result = await runAction({ bookingReference: "", email: "invalid" });

    expect(requestGuestBookingAccess).not.toHaveBeenCalled();
    expect(result).toMatchObject({ init: { status: HTTP_STATUS.BAD_REQUEST } });
  });

  it("only accepts known status messages from the URL", () => {
    expect(
      loader({
        request: new Request("https://tripdly.com/bookings/lookup?status=invalid-link"),
        params: {},
      } as Parameters<typeof loader>[0]),
    ).toMatchObject({ statusMessage: expect.stringContaining("expired") });
    expect(
      loader({
        request: new Request("https://tripdly.com/bookings/lookup?status=attacker-copy"),
        params: {},
      } as Parameters<typeof loader>[0]),
    ).toEqual({ statusMessage: undefined });
  });
});
