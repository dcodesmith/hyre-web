import { type LoaderFunctionArgs } from "@remix-run/node";
import { carIdParamSchema } from "~/schemas/review.schema";
import { handleEntityReviewsRequest } from "~/utils/review-api-helpers.server";

/**
 * GET /api/reviews/car/:carId
 * Get paginated reviews for a specific car
 * Optionally include aggregated ratings
 *
 * Authentication: Not required (public endpoint)
 *
 * Params:
 * - carId: string (CUID)
 *
 * Query params:
 * - page?: number (default: 1)
 * - limit?: number (default: 10, max: 100)
 * - includeRatings?: boolean (default: false) - Include aggregated ratings
 *
 * Response:
 * - 200: Success with reviews and pagination
 * - 400: Invalid parameters
 * - 500: Server error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  return handleEntityReviewsRequest(
    {
      entityType: "car",
      paramName: "carId",
      paramSchema: carIdParamSchema,
      logPrefix: "[API /api/reviews/car/:carId]",
    },
    params,
    request,
  );
}
