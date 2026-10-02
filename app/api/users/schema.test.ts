import { describe, expect, it } from "vitest";

import { currentUserProfileSchema, phoneVerificationSchema } from "./schema";

const profile = {
  name: "Ada Lovelace",
  phoneNumber: "+2348012345678",
  phoneVerified: true,
  city: "Lagos",
  address: "12 Marina",
  marketingConsent: false,
};

describe("currentUserProfileSchema", () => {
  it("requires phoneVerified and drops extras", () => {
    const parsed = currentUserProfileSchema.safeParse({
      ...profile,
      email: "ada@example.com",
      id: "018f47a2-7b3c-7d4e-8f90-123456789451",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data).toEqual(profile);
    expect(
      currentUserProfileSchema.safeParse({ ...profile, phoneVerified: undefined }).success,
    ).toBe(false);
    expect(currentUserProfileSchema.safeParse({ ...profile, phoneVerified: "yes" }).success).toBe(
      false,
    );
  });

  it("accepts an unverified profile with null contact fields", () => {
    expect(
      currentUserProfileSchema.safeParse({
        name: null,
        phoneNumber: null,
        phoneVerified: false,
        city: null,
        address: null,
        marketingConsent: true,
      }).data,
    ).toEqual({
      name: null,
      phoneNumber: null,
      phoneVerified: false,
      city: null,
      address: null,
      marketingConsent: true,
    });
  });
});

describe("phoneVerificationSchema", () => {
  it("accepts pending and verified customer phone checks", () => {
    expect(
      phoneVerificationSchema.parse({ status: "PENDING", phoneNumber: "+234******5678" }),
    ).toEqual({ status: "PENDING", phoneNumber: "+234******5678" });
    expect(
      phoneVerificationSchema.parse({ status: "VERIFIED", phoneNumber: "+2348012345678" }).status,
    ).toBe("VERIFIED");
  });

  it("rejects an unknown status or a missing phone number", () => {
    expect(
      phoneVerificationSchema.safeParse({ status: "EXPIRED", phoneNumber: "+2348012345678" })
        .success,
    ).toBe(false);
    expect(phoneVerificationSchema.safeParse({ status: "PENDING" }).success).toBe(false);
  });
});
