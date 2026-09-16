import { describe, expect, it } from "vitest";

import {
  DRIVERS_LICENSE_NUMBER_INVALID,
  DRIVERS_LICENSE_NUMBER_REQUIRED,
  driversLicenseNumberSchema,
  normalizeDriversLicenseNumber,
  optionalDriversLicenseNumberSchema,
} from "./drivers-license-number";

describe("normalizeDriversLicenseNumber", () => {
  it("uppercases and strips spaces and hyphens", () => {
    expect(normalizeDriversLicenseNumber("  abc-12345-de67  ")).toBe("ABC12345DE67");
    expect(normalizeDriversLicenseNumber("fn 63483 at78")).toBe("FN63483AT78");
  });
});

describe("driversLicenseNumberSchema", () => {
  it("canonicalizes a hyphenated 3-letter number", () => {
    expect(driversLicenseNumberSchema.parse("  abc-12345-de67  ")).toBe("ABC12345DE67");
  });

  it("accepts the 2-letter FRSC shape", () => {
    expect(driversLicenseNumberSchema.parse("FN63483AT78")).toBe("FN63483AT78");
  });

  it("uses the required message for a blank value", () => {
    const parsed = driversLicenseNumberSchema.safeParse("   ");

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(DRIVERS_LICENSE_NUMBER_REQUIRED);
    }
  });

  it("rejects a legacy short number", () => {
    const parsed = driversLicenseNumberSchema.safeParse("ABC12345");

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(DRIVERS_LICENSE_NUMBER_INVALID);
    }
  });
});

describe("optionalDriversLicenseNumberSchema", () => {
  it("keeps a blank value empty so Conform can show a required message later", () => {
    expect(optionalDriversLicenseNumberSchema.parse("")).toBe("");
    expect(optionalDriversLicenseNumberSchema.parse("   ")).toBe("");
  });

  it("canonicalizes a present number", () => {
    expect(optionalDriversLicenseNumberSchema.parse("ABC 12345 DE67")).toBe("ABC12345DE67");
  });
});
