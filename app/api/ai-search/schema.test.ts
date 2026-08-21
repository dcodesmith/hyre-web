import { describe, expect, it } from "vitest";

import { aiSearchQuerySchema } from "./ai-search-form-schema";
import { aiSearchResponseSchema } from "./schema";

describe("aiSearchQuerySchema", () => {
  it("requires a trimmed query and caps length", () => {
    expect(aiSearchQuerySchema.safeParse("").success).toBe(false);
    expect(aiSearchQuerySchema.safeParse("   ").success).toBe(false);
    expect(aiSearchQuerySchema.parse("  Black Toyota SUV  ")).toBe("Black Toyota SUV");
    expect(aiSearchQuerySchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("aiSearchResponseSchema", () => {
  it("keeps search params and drops provider extras", () => {
    const parsed = aiSearchResponseSchema.safeParse({
      params: {
        vehicleType: "SUV",
        make: "Toyota",
        bookingType: "DAY",
      },
      interpretation: "Looking for: Toyota suv",
      raw: { vehicleType: "SUV" },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.params.vehicleType).toBe("SUV");
      expect(parsed.data).not.toHaveProperty("raw");
      expect(parsed.data).not.toHaveProperty("interpretation");
    }
  });
});
