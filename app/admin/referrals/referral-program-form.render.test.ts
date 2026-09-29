import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: undefined,
    Form: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("form", props, children),
  }),
}));

import type { ReferralProgram } from "~/api/admin/referrals/schema";
import { AdminReferralProgramPage } from "./admin-referral-program-page";

const history = {
  data: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
};

const program = {
  id: "default",
  status: "ACTIVE",
  refereeDiscount: { type: "FIXED", amount: 10_000 },
  referrerReward: { type: "FIXED", amount: 5_000 },
  minimumBookingAmount: 50_000,
  eligibleBookingTypes: ["DAY", "FULL_DAY"],
  referralValidityDays: 30,
  maxCreditsPerBookingAmount: 30_000,
  maxCreditsPerBookingPercent: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdById: "018f47a2-7b3c-7d4e-8f90-123456789701",
  updatedById: "018f47a2-7b3c-7d4e-8f90-123456789701",
} satisfies ReferralProgram;

function render(current: ReferralProgram | null) {
  return renderToStaticMarkup(
    createElement(AdminReferralProgramPage, { program: current, history }),
  );
}

describe("admin referral programme page", () => {
  it("renders the create form when the programme is not configured", () => {
    const markup = render(null);

    expect(markup).toContain("NOT CONFIGURED");
    expect(markup).toContain("Create and activate programme");
    expect(markup).not.toContain("Unable to load the referral programme");
  });

  it("renders the current programme and save form", () => {
    const markup = render(program);

    expect(markup).toContain("Current programme");
    expect(markup).toContain("Save programme");
  });
});
