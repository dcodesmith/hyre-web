import { z } from "zod";

export const bookingExtensionFormSchema = z.object({
  bookingLegId: z.string().min(1, "Choose a booking day."),
  hours: z.coerce.number().int().min(1).max(24),
  idempotencyKey: z.uuid(),
});

export type BookingExtensionActionData = {
  error?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof bookingExtensionFormSchema>, string[]>>;
  revalidate?: false;
};
