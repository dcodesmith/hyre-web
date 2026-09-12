import { z } from "zod";

export const publicRatesSchema = z.object({
  platformCustomerServiceFeeRatePercent: z.number().nonnegative(),
  vatRatePercent: z.number().nonnegative(),
});

export type PublicRates = z.infer<typeof publicRatesSchema>;
