import { z } from "zod";

export const MAX_PROMOTION_PERCENTAGE = 50;

export const promotionSchema = z
  .object({
    name: z.string().optional(),
    carId: z.string().min(1),
    discountValue: z
      .number({ error: "Discount percentage is required" })
      .min(1, "Discount must be at least 1%")
      .max(MAX_PROMOTION_PERCENTAGE, `Discount cannot exceed ${MAX_PROMOTION_PERCENTAGE}%`),
    startDate: z.iso.date({ error: "Start date is required" }),
    endDate: z.iso.date({ error: "End date is required" }),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });
