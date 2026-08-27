import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserReferralSummary } = vi.hoisted(() => ({
  getCurrentUserReferralSummary: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    API_ORIGIN: "https://api.example",
    APP_ORIGIN: "https://tripdly.com",
  },
}));

vi.mock("~/api/referrals/referrals.server", () => ({
  getCurrentUserReferralSummary,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { loader } from "./referrals";

const summary = {
  referralCode: "ABCD1234",
  shareLink: "https://api.example/auth?ref=ABCD1234",
  programEnabled: true,
  discountAmount: 10_000,
  hasUsedDiscount: false,
  referredBy: null,
  signupDate: null,
  stats: {
    totalReferrals: 0,
    totalRewardsGranted: 0,
    totalRewardsPending: 0,
    lastReferralAt: null,
    totalEarned: 0,
    totalUsed: 0,
    availableCredits: 0,
    maxCreditsPerBooking: 30_000,
  },
  referrals: [],
  rewards: [],
};

const pageSummary = {
  referralCode: summary.referralCode,
  programEnabled: summary.programEnabled,
  discountAmount: summary.discountAmount,
  stats: {
    totalReferrals: summary.stats.totalReferrals,
    totalRewardsGranted: summary.stats.totalRewardsGranted,
    totalRewardsPending: summary.stats.totalRewardsPending,
    totalUsed: summary.stats.totalUsed,
    availableCredits: summary.stats.availableCredits,
  },
  referrals: summary.referrals,
  rewards: summary.rewards,
};

function runLoader(cookie = "better-auth.session_token=test-session") {
  return loader({
    request: new Request("https://tripdly.com/referrals", {
      headers: cookie ? { cookie } : undefined,
    }),
    params: {},
  } as Parameters<typeof loader>[0]);
}

describe("referrals loader", () => {
  beforeEach(() => {
    getCurrentUserReferralSummary.mockReset();
  });

  it("sends guests to login before calling the API", async () => {
    const response = await runLoader("").catch((error: unknown) => error);

    expect(getCurrentUserReferralSummary).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/auth?redirectTo=%2Freferrals");
  });

  it("sends expired sessions to login", async () => {
    getCurrentUserReferralSummary.mockRejectedValueOnce(
      new ApiRequestError("http", HTTP_STATUS.UNAUTHORIZED, {
        type: "AUTH_ERROR",
        title: "Authentication failed",
        status: HTTP_STATUS.UNAUTHORIZED,
        detail: "Unauthorized",
      }),
    );

    const response = await runLoader().catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/auth?redirectTo=%2Freferrals");
  });

  it("loads the summary and uses the trusted web origin for sharing", async () => {
    getCurrentUserReferralSummary.mockResolvedValueOnce({
      data: summary,
      status: HTTP_STATUS.OK,
      headers: new Headers(),
    });

    await expect(runLoader()).resolves.toEqual({
      summary: pageSummary,
      shareLink: "https://tripdly.com/auth?ref=ABCD1234",
    });
    expect(getCurrentUserReferralSummary).toHaveBeenCalledWith({
      request: expect.any(Request),
    });
  });

  it("omits the share link when the user has no referral code", async () => {
    const summaryWithoutCode = { ...summary, referralCode: null };
    getCurrentUserReferralSummary.mockResolvedValueOnce({
      data: summaryWithoutCode,
      status: HTTP_STATUS.OK,
      headers: new Headers(),
    });

    await expect(runLoader()).resolves.toEqual({
      summary: { ...pageSummary, referralCode: null },
      shareLink: null,
    });
  });
});
