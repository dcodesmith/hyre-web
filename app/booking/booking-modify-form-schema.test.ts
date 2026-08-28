import { describe, expect, it } from "vitest";

import { bookingModifyFormSchema } from "~/booking/booking-modify-form-schema";

describe("bookingModifyFormSchema", () => {
  it("builds the API update payload", () => {
    expect(
      bookingModifyFormSchema.parse({
        intent: "modify",
        pickupTime: "9:00 AM",
        pickupAddress: "  Ikeja GRA  ",
        sameLocation: "false",
        dropOffAddress: "  Victoria Island  ",
      }),
    ).toEqual({
      pickupTime: "9:00 AM",
      pickupAddress: "Ikeja GRA",
      sameLocation: false,
      dropOffAddress: "Victoria Island",
    });
  });

  it("omits the drop-off address when both locations match", () => {
    expect(
      bookingModifyFormSchema.parse({
        intent: "modify",
        pickupAddress: "Ikeja GRA",
        sameLocation: "true",
        dropOffAddress: "Ignored",
      }),
    ).toEqual({
      pickupAddress: "Ikeja GRA",
      sameLocation: true,
    });
  });

  it("rejects invalid pickup and drop-off details", () => {
    const result = bookingModifyFormSchema.safeParse({
      intent: "modify",
      pickupTime: "25:00",
      pickupAddress: " ",
      sameLocation: "false",
      dropOffAddress: " ",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["pickupTime"] }),
        expect.objectContaining({ path: ["pickupAddress"] }),
        expect.objectContaining({ path: ["dropOffAddress"] }),
      ]),
    );
  });
});
