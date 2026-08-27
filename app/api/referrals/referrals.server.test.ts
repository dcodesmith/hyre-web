import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { getCurrentUserReferralSummary } from "./referrals.server";

const summary = {
  referralCode: "ABCD1234",
  shareLink: "https://api.example/auth?ref=ABCD1234",
  programEnabled: true,
  discountAmount: 10_000,
  hasUsedDiscount: false,
  referredBy: null,
  signupDate: null,
  stats: {
    totalReferrals: 1,
    totalRewardsGranted: 10_000,
    totalRewardsPending: 0,
    lastReferralAt: "2026-08-20T12:00:00.000Z",
    totalEarned: 10_000,
    totalUsed: 0,
    availableCredits: 10_000,
    maxCreditsPerBooking: 30_000,
  },
  referrals: [
    {
      id: "user-2",
      name: "Ada Friend",
      email: "friend@example.com",
      createdAt: "2026-08-20T12:00:00.000Z",
    },
  ],
  rewards: [
    {
      id: "reward-1",
      amount: 10_000,
      status: "RELEASED",
      createdAt: "2026-08-22T12:00:00.000Z",
      processedAt: "2026-08-23T12:00:00.000Z",
      refereeName: "Ada Friend",
    },
  ],
};

describe("getCurrentUserReferralSummary", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads and validates the authenticated referral summary", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(summary));

    const response = await getCurrentUserReferralSummary({
      request: new Request("https://tripdly.com/referrals", {
        headers: {
          cookie: "better-auth.session_token=session-1",
          "x-request-id": "request-1",
        },
      }),
    });

    expect(response.data).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example/api/referrals/user");
    expect(init?.method).toBe("GET");

    const headers = init?.headers as Headers;
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("x-request-id")).toBe("request-1");
  });

  it("rejects an invalid referral summary", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...summary,
        rewards: [{ ...summary.rewards[0], status: "UNKNOWN" }],
      }),
    );

    await expect(
      getCurrentUserReferralSummary({
        request: new Request("https://tripdly.com/referrals", {
          headers: { cookie: "better-auth.session_token=session-1" },
        }),
      }),
    ).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });
});
