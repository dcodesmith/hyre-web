import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import { referralProgramFormSchema } from "./referral-program-form-schema";

const validFixed = {
  refereeDiscountType: "FIXED",
  refereeDiscountAmount: "10000",
  referrerRewardType: "FIXED",
  referrerRewardAmount: "5000",
  minimumBookingAmount: "50000",
  eligibleBookingTypes: ["DAY", "FULL_DAY"],
  referralValidityDays: "30",
  maxCreditsPerBookingAmount: "30000",
  maxCreditsPerBookingPercent: "50",
};

const validPercentage = {
  refereeDiscountType: "PERCENTAGE",
  refereeDiscountPercentage: "10",
  refereeDiscountMaxAmount: "20000",
  referrerRewardType: "PERCENTAGE",
  referrerRewardPercentage: "5",
  referrerRewardMaxAmount: "15000",
  minimumBookingAmount: "50000.25",
  eligibleBookingTypes: ["DAY"],
  referralValidityDays: "0",
  maxCreditsPerBookingAmount: "0",
  maxCreditsPerBookingPercent: "100",
};

function formDataFrom(fields: Record<string, string | string[]>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        formData.append(name, item);
      }
    } else {
      formData.set(name, value);
    }
  }
  return formData;
}

function issueMessage(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  field: string,
) {
  return error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("referralProgramFormSchema", () => {
  it("transforms a fixed programme into API incentives", () => {
    expect(referralProgramFormSchema.parse(validFixed)).toEqual({
      refereeDiscount: { type: "FIXED", amount: 10_000 },
      referrerReward: { type: "FIXED", amount: 5_000 },
      minimumBookingAmount: 50_000,
      eligibleBookingTypes: ["DAY", "FULL_DAY"],
      referralValidityDays: 30,
      maxCreditsPerBookingAmount: 30_000,
      maxCreditsPerBookingPercent: 50,
    });
  });

  it("transforms a percentage programme and treats blank unused money as omitted", () => {
    expect(
      referralProgramFormSchema.parse({
        ...validPercentage,
        refereeDiscountAmount: "",
        referrerRewardAmount: "",
      }),
    ).toEqual({
      refereeDiscount: { type: "PERCENTAGE", percentage: 10, maxAmount: 20_000 },
      referrerReward: { type: "PERCENTAGE", percentage: 5, maxAmount: 15_000 },
      minimumBookingAmount: 50_000.25,
      eligibleBookingTypes: ["DAY"],
      referralValidityDays: 0,
      maxCreditsPerBookingAmount: 0,
      maxCreditsPerBookingPercent: 100,
    });
  });

  it("requires the fields that match each incentive type", () => {
    const missingFixed = referralProgramFormSchema.safeParse({
      ...validFixed,
      refereeDiscountAmount: "",
      referrerRewardAmount: "",
    });
    expect(missingFixed.success).toBe(false);
    if (!missingFixed.success) {
      expect(issueMessage(missingFixed.error, "refereeDiscountAmount")).toBe(
        "This value is required",
      );
      expect(issueMessage(missingFixed.error, "referrerRewardAmount")).toBe(
        "This value is required",
      );
    }

    const missingPercentage = referralProgramFormSchema.safeParse({
      ...validPercentage,
      refereeDiscountPercentage: "",
      refereeDiscountMaxAmount: "",
      referrerRewardPercentage: "",
      referrerRewardMaxAmount: "",
    });
    expect(missingPercentage.success).toBe(false);
    if (!missingPercentage.success) {
      expect(issueMessage(missingPercentage.error, "refereeDiscountPercentage")).toBe(
        "This value is required",
      );
      expect(issueMessage(missingPercentage.error, "refereeDiscountMaxAmount")).toBe(
        "This value is required",
      );
      expect(issueMessage(missingPercentage.error, "referrerRewardPercentage")).toBe(
        "This value is required",
      );
      expect(issueMessage(missingPercentage.error, "referrerRewardMaxAmount")).toBe(
        "This value is required",
      );
    }
  });

  it("requires at least one unique booking type from FormData", () => {
    expect(
      referralProgramFormSchema.safeParse({ ...validFixed, eligibleBookingTypes: [] }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        eligibleBookingTypes: ["DAY", "DAY"],
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        eligibleBookingTypes: ["HOURLY"],
      }).success,
    ).toBe(false);

    const submission = parseWithZod(formDataFrom(validFixed), {
      schema: referralProgramFormSchema,
    });
    expect(submission.status).toBe("success");
    if (submission.status === "success") {
      expect(submission.value.eligibleBookingTypes).toEqual(["DAY", "FULL_DAY"]);
    }
  });

  it("rejects invalid amounts, percentages, caps, and validity days", () => {
    expect(
      referralProgramFormSchema.safeParse({ ...validFixed, refereeDiscountAmount: "0" }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({ ...validFixed, refereeDiscountAmount: "12.345" })
        .success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validPercentage,
        refereeDiscountPercentage: "101",
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        maxCreditsPerBookingAmount: "-1",
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        maxCreditsPerBookingPercent: "101",
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        referralValidityDays: "1.5",
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        referralValidityDays: "3651",
      }).success,
    ).toBe(false);
    expect(
      referralProgramFormSchema.safeParse({
        ...validFixed,
        minimumBookingAmount: "100000000",
      }).success,
    ).toBe(false);
  });

  it("keeps unused incentive fields from changing the transformed type", () => {
    expect(
      referralProgramFormSchema.parse({
        ...validFixed,
        refereeDiscountPercentage: "25",
        refereeDiscountMaxAmount: "8000",
      }).refereeDiscount,
    ).toEqual({ type: "FIXED", amount: 10_000 });
  });
});
