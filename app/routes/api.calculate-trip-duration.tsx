import { type LoaderFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import logger from "~/lib/logger.server";
import { calculateAirportTripDuration } from "~/services/google-maps.server";

const TripDurationQuerySchema = z.object({
  destination: z.string().min(1, "Destination address is required"),
  arrivalTime: z
    .string()
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: "Invalid date format",
    })
    .optional(),
});

/**
 * API endpoint to calculate trip duration from Lagos airport to destination
 * Used by the frontend to show estimated drive time for AIRPORT_PICKUP bookings
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  const validation = TripDurationQuerySchema.safeParse({
    destination: url.searchParams.get("destination"),
    arrivalTime: url.searchParams.get("arrivalTime") || undefined,
  });

  if (!validation.success) {
    return Response.json(
      {
        success: false,
        error: validation.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 },
    );
  }

  const { destination, arrivalTime } = validation.data;

  try {
    const arrivalDate = arrivalTime ? new Date(arrivalTime) : undefined;

    logger.info(
      `[API /api/calculate-trip-duration] Calculating trip duration to: ${destination}, arrival: ${arrivalDate?.toISOString() ?? "N/A"}`,
    );

    const result = await calculateAirportTripDuration(destination, arrivalDate);

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(
      `[API /api/calculate-trip-duration] Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return Response.json(
      {
        success: false,
        error: "Failed to calculate trip duration",
      },
      { status: 500 },
    );
  }
}
