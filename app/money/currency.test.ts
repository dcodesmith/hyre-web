import { describe, expect, it } from "vitest";

import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("keeps whole money values free of decimal noise", () => {
    expect(formatCurrency(79_012, "NGN")).toBe("₦79,012");
  });

  it("preserves fractional API money values", () => {
    expect(formatCurrency(79_012.5, "NGN")).toBe("₦79,012.50");
  });
});
