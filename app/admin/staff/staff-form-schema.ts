import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

import { EMAIL_INVALID_ERROR } from "~/auth/auth-form-schema";

export const STAFF_NAME_ERROR = "Name must be at least 2 characters";
export const STAFF_PHONE_ERROR = "Phone must be at least 10 digits";

export const staffFormSchema = z.object({
  name: z.string({ error: STAFF_NAME_ERROR }).trim().min(2, STAFF_NAME_ERROR).max(200),
  email: z
    .string({ error: EMAIL_INVALID_ERROR })
    .trim()
    .toLowerCase()
    .pipe(z.email(EMAIL_INVALID_ERROR)),
  phoneNumber: z.string({ error: STAFF_PHONE_ERROR }).trim().min(10, STAFF_PHONE_ERROR).max(32),
});

export type StaffActionData = {
  intent: "create" | "revoke" | "reinstate";
  error?: string;
  revalidate?: boolean;
  success?: string;
  submission?: SubmissionResult<string[]>;
};
