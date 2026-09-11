import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

export const inviteChauffeurFormSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(2).max(120),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  phoneNumber: z
    .string({ error: "Phone number is required" })
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use international format, for example +2348012345678"),
  idempotencyKey: z.uuid(),
});

export const updateChauffeurFormSchema = z.object({
  chauffeurId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ChauffeurActionData =
  | {
      readonly intent: "invite";
      readonly error?: string;
      readonly idempotencyKey?: string;
      readonly revalidate?: false;
      readonly submission?: SubmissionResult<string[]>;
    }
  | {
      readonly intent: "update";
      readonly chauffeurId?: string;
      readonly error?: string;
      readonly revalidate?: false;
    };
