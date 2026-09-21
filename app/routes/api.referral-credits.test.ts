import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserReferralSummary } = vi.hoisted(() => ({
  getCurrentUserReferralSummary: vi.fn(),
}));

vi.mock("~/api/referrals/referrals.server", () => ({
  getCurrentUserReferralSummary,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { loader } from "./api.referral-credits";

function apiError(status: number, detail: string, kind: "aborted" | "http" = "http") {
  return new ApiRequestError(kind, status, {
    type: "REFERRAL_ERROR",
    title: "Referral error",
    status,
    detail,
  });
}

function runLoader() {
  return loader({
    request: new Request("https://tripdly.com/api/referral-credits", {
      headers: { cookie: "better-auth.session_token=session-1" },
    }),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0]);
}

describe("referral credits resource", () => {
  beforeEach(() => {
    getCurrentUserReferralSummary.mockReset();
  });

  it("projects available credits and the booking cap", async () => {
    getCurrentUserReferralSummary.mockResolvedValue({
      data: {
        stats: {
          availableCredits: 15_000,
          maxCreditsPerBooking: 30_000,
        },
      },
    });

    await expect(runLoader()).resolves.toMatchObject({
      data: {
        availableCredits: 15_000,
        maxCreditsPerBooking: 30_000,
        error: null,
      },
    });
    expect(getCurrentUserReferralSummary).toHaveBeenCalledWith({
      request: expect.any(Request),
    });
  });

  it("returns zeros and a retry message when the API fails", async () => {
    getCurrentUserReferralSummary.mockRejectedValue(
      apiError(HTTP_STATUS.FORBIDDEN, "Credits are unavailable"),
    );

    await expect(runLoader()).resolves.toMatchObject({
      data: {
        availableCredits: 0,
        maxCreditsPerBooking: 0,
        error: "Unable to check your referral credit. Please try again.",
      },
      init: { status: HTTP_STATUS.FORBIDDEN },
    });
  });

  it("uses a bad-gateway status for unexpected failures", async () => {
    getCurrentUserReferralSummary.mockRejectedValue(new Error("socket hang up"));

    await expect(runLoader()).resolves.toMatchObject({
      data: {
        availableCredits: 0,
        maxCreditsPerBooking: 0,
        error: "Unable to check your referral credit. Please try again.",
      },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
  });

  it("rethrows an aborted request", async () => {
    const aborted = apiError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "Aborted", "aborted");
    getCurrentUserReferralSummary.mockRejectedValue(aborted);

    await expect(runLoader()).rejects.toBe(aborted);
  });
});
