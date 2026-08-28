import { describe, expect, it } from "vitest";

import {
  adminFinancialDetailPath,
  adminFinancialsPath,
  parseFinancialsView,
} from "./financials-url";

describe("admin financials URL", () => {
  it("defaults to the refund attention queue", () => {
    expect(parseFinancialsView(new URLSearchParams())).toEqual({
      kind: "refunds",
      page: 1,
      attentionOnly: true,
      status: undefined,
    });
  });

  it("parses payout filters and normalizes invalid values", () => {
    expect(
      parseFinancialsView(new URLSearchParams("type=payouts&scope=all&status=PROCESSING&page=2")),
    ).toEqual({
      kind: "payouts",
      page: 2,
      attentionOnly: false,
      status: "PROCESSING",
    });
    expect(
      parseFinancialsView(new URLSearchParams("type=other&status=PROCESSING&page=none")),
    ).toEqual({
      kind: "refunds",
      page: 1,
      attentionOnly: true,
      status: undefined,
    });
  });

  it("serializes canonical list and detail paths", () => {
    const view = {
      kind: "payouts" as const,
      page: 3,
      attentionOnly: false,
      status: "FAILED" as const,
    };

    expect(adminFinancialsPath(view)).toBe(
      "/admin/financials?type=payouts&scope=all&status=FAILED&page=3",
    );
    expect(adminFinancialDetailPath("payout/1", view)).toBe(
      "/admin/financials/payouts/payout%2F1?type=payouts&scope=all&status=FAILED&page=3",
    );
  });
});
