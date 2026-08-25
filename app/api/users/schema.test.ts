import { describe, expect, it } from "vitest";

import { currentUserProfileSchema } from "./schema";

describe("currentUserProfileSchema", () => {
  it("keeps profile fields and drops extras", () => {
    const parsed = currentUserProfileSchema.safeParse({
      name: "Ada Lovelace",
      phoneNumber: "+2348012345678",
      city: "Lagos",
      address: "12 Marina",
      marketingConsent: false,
      email: "ada@example.com",
      id: "user-1",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data).toEqual({
      name: "Ada Lovelace",
      phoneNumber: "+2348012345678",
      city: "Lagos",
      address: "12 Marina",
      marketingConsent: false,
    });
  });

  it("accepts nulls", () => {
    expect(
      currentUserProfileSchema.safeParse({
        name: null,
        phoneNumber: null,
        city: null,
        address: null,
        marketingConsent: true,
      }).success,
    ).toBe(true);
  });
});
