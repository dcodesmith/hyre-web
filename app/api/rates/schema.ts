import { z } from "zod";

export const publicRatesSchema = z.object({
  platformCustomerServiceFeeRatePercent: z.number(),
  vatRatePercent: z.number(),
  securityDetailRate: z.number(),
});

export type PublicRates = z.infer<typeof publicRatesSchema>;
