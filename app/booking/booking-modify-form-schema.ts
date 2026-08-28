import { z } from "zod";

import { parsePickupClock } from "~/booking/pickup";

export const bookingModifyFormSchema = z
  .object({
    intent: z.literal("modify"),
    pickupTime: z.string().trim().optional(),
    pickupAddress: z.string().trim().min(1, "Pickup address is required."),
    sameLocation: z.enum(["true", "false"]),
    dropOffAddress: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.pickupTime && !parsePickupClock(value.pickupTime)) {
      context.addIssue({
        code: "custom",
        message: "Select a valid pickup time.",
        path: ["pickupTime"],
      });
    }

    if (value.sameLocation === "false" && !value.dropOffAddress) {
      context.addIssue({
        code: "custom",
        message: "Drop-off address is required.",
        path: ["dropOffAddress"],
      });
    }
  })
  .transform(({ intent: _intent, pickupTime, sameLocation, dropOffAddress, ...value }) => ({
    ...value,
    ...(pickupTime ? { pickupTime } : {}),
    sameLocation: sameLocation === "true",
    ...(sameLocation === "false" ? { dropOffAddress } : {}),
  }));
