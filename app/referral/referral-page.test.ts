import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./use-copy-feedback", () => ({
  useCopyFeedback: () => ({
    copiedTarget: null,
    copyError: null,
    copyToClipboard: () => undefined,
  }),
}));

import { ReferralPage, type ReferralPageSummary } from "./referral-page";

const summary: ReferralPageSummary = {
  referralCode: "ADA2026X",
  programEnabled: true,
  discount: { type: "FIXED", amount: 10_000 },
  stats: {
    totalReferrals: 1,
    totalRewardsGranted: 10_000,
    totalRewardsPending: 0,
    totalUsed: 0,
    availableCredits: 10_000,
  },
  referrals: [],
  rewards: [],
};

function renderPage(overrides: Partial<ReferralPageSummary> = {}) {
  return renderToStaticMarkup(
    createElement(ReferralPage, {
      summary: { ...summary, ...overrides },
      shareLink: "https://tripdly.com/auth?ref=ADA2026X",
    }),
  );
}

describe("ReferralPage offer copy", () => {
  it("describes a fixed first-booking discount", () => {
    const markup = renderPage();

    expect(markup).toContain("₦10,000 off their first eligible booking");
    expect(markup).toContain("Available credit");
    expect(markup).toContain("Used credit");
  });

  it("describes a percentage first-booking discount with a cap", () => {
    expect(
      renderPage({
        discount: { type: "PERCENTAGE", percentage: 10, maxAmount: 20_000 },
      }),
    ).toContain("10% off, up to ₦20,000, on their first eligible booking");
  });

  it("uses generic copy when the offer is null", () => {
    expect(renderPage({ discount: null })).toContain(
      "They get a first-booking discount. You earn referral credit after they complete that booking.",
    );
  });

  it("shows the paused programme banner without hiding the code", () => {
    const markup = renderPage({ programEnabled: false });

    expect(markup).toContain("Referral Program Temporarily Disabled");
    expect(markup).toContain("New referrals cannot be processed at this time.");
    expect(markup).toContain("ADA2026X");
  });
});
