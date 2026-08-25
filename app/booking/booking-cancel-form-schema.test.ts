import { describe, expect, it } from "vitest";

import { cancelBookingFormSchema } from "./booking-cancel-form-schema";

describe("cancelBookingFormSchema", () => {
  it("accepts only the cancel intent", () => {
    expect(cancelBookingFormSchema.parse({ intent: "cancel" })).toEqual({ intent: "cancel" });
    expect(cancelBookingFormSchema.safeParse({ intent: "modify" }).success).toBe(false);
    expect(cancelBookingFormSchema.safeParse({}).success).toBe(false);
  });
});
