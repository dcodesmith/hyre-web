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
  stats: {
    totalReferrals: 1,
    totalRewardsGranted: 10_000,
    totalRewardsPending: 0,
    totalUsed: 0,
    availableCredits: 10_000,
  },
  referrals: [],
};

function renderPage(overrides: Partial<ReferralPageSummary> = {}) {
  return renderToStaticMarkup(
    createElement(ReferralPage, {
      summary: { ...summary, ...overrides },
      shareLink: "https://tripdly.com/r/ADA2026X",
    }),
  );
}

describe("ReferralPage", () => {
  it("renders the empty referral history", () => {
    const markup = renderPage();

    expect(markup).toContain("No referral history");
    expect(markup).toContain("Your referral history will appear here.");
    expect(markup).not.toContain("<table");
  });

  it("renders populated history with only reliably mapped referral data", () => {
    const markup = renderPage({
      referrals: [
        {
          id: "018f47a2-7b3c-7d4e-8f90-123456789431",
          name: "Grace Hopper",
          email: "g***@example.com",
          createdAt: "2026-08-20T12:00:00.000Z",
        },
      ],
    });

    expect(markup).toContain("<table");
    expect(markup).toContain("Grace Hopper");
    expect(markup).toContain("g***@example.com");
    expect(markup).toContain("Joined");
    expect(markup).toContain("Page 1/1");
    expect(markup).not.toContain("Amount Earned");
    expect(markup).not.toContain("more-horizontal");
  });

  it("shows the disabled-program banner without hiding sharing", () => {
    const markup = renderPage({ programEnabled: false });

    expect(markup).toContain("Referral program temporarily closed");
    expect(markup).toContain("New referrals cannot be processed at this time.");
    expect(markup).toContain("ADA2026X");
    expect(markup).toContain("https://tripdly.com/r/ADA2026X");
    expect(markup).toContain("Whatsapp");
    expect(markup).toContain("Telegram");
  });
});
