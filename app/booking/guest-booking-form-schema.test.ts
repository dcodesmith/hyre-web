import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import {
  BOOKING_REFERENCE_ERROR,
  GUEST_EMAIL_ERROR,
  guestBookingFormSchema,
} from "./guest-booking-form-schema";

describe("guestBookingFormSchema", () => {
  it("normalizes a valid lookup", () => {
    expect(
      guestBookingFormSchema.parse({
        bookingReference: " bk-guest-001 ",
        email: " Guest@Example.com ",
      }),
    ).toEqual({
      bookingReference: "BK-GUEST-001",
      email: "guest@example.com",
    });
  });

  it("uses the field copy when Conform omits empty values", () => {
    const submission = parseWithZod(new FormData(), { schema: guestBookingFormSchema });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.bookingReference).toContain(BOOKING_REFERENCE_ERROR);
    expect(submission.error?.email).toContain(GUEST_EMAIL_ERROR);
  });

  it("uses the field copy for empty strings", () => {
    const formData = new FormData();
    formData.set("bookingReference", "   ");
    formData.set("email", "");

    const submission = parseWithZod(formData, { schema: guestBookingFormSchema });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.bookingReference).toContain(BOOKING_REFERENCE_ERROR);
    expect(submission.error?.email).toContain(GUEST_EMAIL_ERROR);
  });
});
