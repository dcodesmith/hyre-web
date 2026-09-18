import { describe, expect, it } from "vitest";

import { referralProgramHistorySchema, referralProgramSchema } from "./schema";

const actorId = "018f47a2-7b3c-7d4e-8f90-123456789701";
const createdAt = "2026-01-01T00:00:00.000Z";

const fixedProgram = {
  id: "current-program",
  status: "ACTIVE",
  refereeDiscount: { type: "FIXED", amount: 10_000 },
  referrerReward: { type: "FIXED", amount: 5_000 },
  minimumBookingAmount: 50_000,
  eligibleBookingTypes: ["DAY", "FULL_DAY"],
  referralValidityDays: 30,
  maxCreditsPerBookingAmount: 30_000,
  maxCreditsPerBookingPercent: 50,
  createdAt,
  updatedAt: createdAt,
  createdById: actorId,
  updatedById: actorId,
};

const percentageProgram = {
  ...fixedProgram,
  status: "PAUSED",
  refereeDiscount: { type: "PERCENTAGE", percentage: 10, maxAmount: 20_000 },
  referrerReward: { type: "PERCENTAGE", percentage: 5, maxAmount: 15_000 },
};

describe("referralProgramSchema", () => {
  it("parses a fixed-amount programme and drops extras", () => {
    expect(referralProgramSchema.parse({ ...fixedProgram, actor: "hidden" })).toEqual(fixedProgram);
  });

  it("parses a percentage programme with caps", () => {
    expect(referralProgramSchema.parse(percentageProgram)).toEqual(percentageProgram);
  });

  it("rejects malformed incentive constraints", () => {
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        refereeDiscount: { type: "FIXED" },
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        refereeDiscount: { type: "FIXED", amount: 0 },
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        referrerReward: { type: "PERCENTAGE", percentage: 10 },
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        referrerReward: { type: "PERCENTAGE", percentage: 101, maxAmount: 15_000 },
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        referrerReward: { type: "PERCENTAGE", percentage: 0, maxAmount: 15_000 },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid booking types, validity, and credit caps", () => {
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        eligibleBookingTypes: [],
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        eligibleBookingTypes: ["HOURLY"],
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        minimumBookingAmount: 0,
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        referralValidityDays: -1,
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        referralValidityDays: 3651,
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        maxCreditsPerBookingAmount: -1,
      }).success,
    ).toBe(false);
    expect(
      referralProgramSchema.safeParse({
        ...fixedProgram,
        maxCreditsPerBookingPercent: 101,
      }).success,
    ).toBe(false);
  });
});

describe("referralProgramHistorySchema", () => {
  const history = {
    data: [
      {
        id: "018f47a2-7b3c-7d4e-8f90-1234567890c1",
        action: "CREATED",
        before: null,
        after: fixedProgram,
        actorId,
        createdAt,
      },
      {
        id: "018f47a2-7b3c-7d4e-8f90-1234567890c2",
        action: "UPDATED",
        before: fixedProgram,
        after: percentageProgram,
        actorId,
        createdAt,
      },
      {
        id: "018f47a2-7b3c-7d4e-8f90-1234567890c3",
        action: "STATUS_CHANGED",
        before: { ...percentageProgram, status: "ACTIVE" },
        after: percentageProgram,
        actorId,
        createdAt,
      },
    ],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    },
  };

  it("parses created, updated, and status-changed audit entries", () => {
    expect(referralProgramHistorySchema.parse(history)).toEqual(history);
  });

  it("rejects a malformed history payload", () => {
    expect(
      referralProgramHistorySchema.safeParse({
        ...history,
        data: [{ ...history.data[0], action: "DELETED" }],
      }).success,
    ).toBe(false);
    expect(
      referralProgramHistorySchema.safeParse({
        ...history,
        data: [{ ...history.data[0], before: undefined }],
      }).success,
    ).toBe(false);
    expect(
      referralProgramHistorySchema.safeParse({
        ...history,
        pagination: { ...history.pagination, page: 0 },
      }).success,
    ).toBe(false);
    expect(
      referralProgramHistorySchema.safeParse({
        ...history,
        pagination: { ...history.pagination, totalItems: -1 },
      }).success,
    ).toBe(false);
  });
});
