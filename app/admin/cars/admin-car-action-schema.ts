import { z } from "zod";

const assetIdSchema = z
  .string({ error: "Asset ID is required" })
  .trim()
  .min(1, "Asset ID is required");

export const adminCarActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("approve-car") }),
  z.object({ intent: z.literal("set-cover"), assetId: assetIdSchema }),
  z.object({
    intent: z.enum(["approve-image", "approve-document"]),
    assetId: assetIdSchema,
  }),
  z.object({
    intent: z.enum(["reject-image", "reject-document"]),
    assetId: assetIdSchema,
    notes: z
      .string({ error: "Enter a rejection reason" })
      .trim()
      .min(1, "Enter a rejection reason"),
  }),
]);

export type AdminCarActionData = {
  readonly success?: true;
  readonly error?: string;
};
