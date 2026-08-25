import { z } from "zod";

export const cancelBookingFormSchema = z.object({
  intent: z.literal("cancel"),
});
