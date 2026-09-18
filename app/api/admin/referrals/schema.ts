import { z } from "zod";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

export const referralProgramStatusSchema = z.enum(["ACTIVE", "PAUSED"]);
export const referralIncentiveTypeSchema = z.enum(["FIXED", "PERCENTAGE"]);

export const referralIncentiveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FIXED"),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal("PERCENTAGE"),
    percentage: z.number().positive().max(100),
    maxAmount: z.number().positive(),
  }),
]);

export const referralProgramSchema = z.object({
  id: z.string(),
  status: referralProgramStatusSchema,
  refereeDiscount: referralIncentiveSchema,
  referrerReward: referralIncentiveSchema,
  minimumBookingAmount: z.number().positive(),
  eligibleBookingTypes: z.array(z.enum(BOOKING_TYPE_OPTIONS)).min(1),
  referralValidityDays: z.number().int().min(0).max(3650),
  maxCreditsPerBookingAmount: z.number().min(0),
  maxCreditsPerBookingPercent: z.number().min(0).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  createdById: z.uuid(),
  updatedById: z.uuid(),
});

const referralProgramAuditSchema = z.object({
  id: z.uuid(),
  action: z.enum(["CREATED", "UPDATED", "STATUS_CHANGED"]),
  before: referralProgramSchema.nullable(),
  after: referralProgramSchema,
  actorId: z.uuid(),
  createdAt: z.iso.datetime(),
});

export const referralProgramHistorySchema = z.object({
  data: z.array(referralProgramAuditSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type ReferralIncentive = z.output<typeof referralIncentiveSchema>;
export type ReferralProgram = z.output<typeof referralProgramSchema>;
export type ReferralProgramHistory = z.output<typeof referralProgramHistorySchema>;
export type ReferralProgramStatus = z.output<typeof referralProgramStatusSchema>;
export type ReferralProgramValues = Pick<
  ReferralProgram,
  | "refereeDiscount"
  | "referrerReward"
  | "minimumBookingAmount"
  | "eligibleBookingTypes"
  | "referralValidityDays"
  | "maxCreditsPerBookingAmount"
  | "maxCreditsPerBookingPercent"
>;
