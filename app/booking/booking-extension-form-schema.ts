import { z } from "zod";

export const bookingExtensionFormSchema = z.object({
  bookingLegId: z.string({ error: "Choose a booking day." }).min(1, "Choose a booking day."),
  hours: z.coerce.number({ error: "Choose an extension length." }).int().min(1).max(24),
  idempotencyKey: z.uuid("Please retry this extension."),
});

export type BookingExtensionActionData = {
  error?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof bookingExtensionFormSchema>, string[]>>;
  revalidate?: false;
};
